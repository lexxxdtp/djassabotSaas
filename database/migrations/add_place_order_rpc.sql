-- ============================================================================
-- place_order / transition_order_status : commande, stock et statut en UNE
-- transaction (audit du 14 septembre 2026, constats A02 et A10).
--
-- POURQUOI : le stock était décrémenté article par article depuis Node, puis la
-- commande insérée à part. Deux annulations simultanées lisaient toutes deux
-- l'ancien statut et rendaient le stock deux fois ; une insertion réussie dont
-- la réponse réseau se perdait déclenchait une remise en stock alors que la
-- commande existait. Ici, tout réussit ou rien ne change.
--
-- place_order : clé d'idempotence vérifiée, stock réservé (adjust_stock, verrou
-- de ligne), commande insérée. Stock insuffisant → rien n'est écrit et la liste
-- des manques est renvoyée. Même clé rejouée → la commande existante est rendue
-- sans second débit : un appel dont la réponse s'est perdue peut être retenté.
--
-- transition_order_status : verrou sur la commande, contrôle du statut de départ
-- (un paiement tardif ne fait plus repasser une commande livrée ou annulée à
-- PAID), remise en stock à l'annulation, reprise du stock à la réactivation
-- (refusée si le stock manque), puis changement de statut — une seule fois.
--
-- Prérequis : add_adjust_stock_rpc.sql et add_order_idempotency_key.sql.
-- Le backend fonctionne sans cette migration (chemin de secours), mais sans la
-- garantie transactionnelle. À APPLIQUER : SQL Editor → coller ce fichier → Run.
-- ============================================================================

create or replace function place_order(
    p_tenant_id uuid,
    p_order_id text,
    p_user_id text,
    p_items jsonb,
    p_total integer,
    p_address text,
    p_idempotency_key text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
    v_existing orders%rowtype;
    v_order orders%rowtype;
    v_item jsonb;
    v_qty integer;
    v_variations jsonb;
    v_stock record;
    v_failures jsonb := '[]'::jsonb;
begin
    if jsonb_typeof(p_items) is distinct from 'array' or p_total is null or p_total < 0 then
        raise exception 'place_order : articles ou total invalides' using errcode = '22023';
    end if;

    if p_idempotency_key is not null then
        select * into v_existing from orders
        where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
        if found then
            return jsonb_build_object('status', 'existing', 'order', to_jsonb(v_existing));
        end if;
    end if;

    begin
        -- Ordre stable des verrous : deux paniers aux mêmes produits ne s'interbloquent pas.
        for v_item in
            select value from jsonb_array_elements(p_items) order by value->>'productId'
        loop
            continue when coalesce(v_item->>'productId', '') = '_delivery';
            v_qty := (v_item->>'quantity')::integer;
            if v_qty is null or v_qty < 1 then
                raise exception 'place_order : quantité invalide' using errcode = '22023';
            end if;
            v_variations := case
                when jsonb_typeof(v_item->'selectedVariations') = 'array'
                     and jsonb_array_length(v_item->'selectedVariations') > 0
                then v_item->'selectedVariations' end;

            select * into v_stock from adjust_stock(p_tenant_id, v_item->>'productId', -v_qty, v_variations);
            if not coalesce(v_stock.success, false) then
                v_failures := v_failures || jsonb_build_array(jsonb_build_object(
                    'productId', v_item->>'productId',
                    'productName', v_item->>'productName',
                    'requested', v_qty,
                    'available', v_stock.available));
            end if;
        end loop;

        if jsonb_array_length(v_failures) > 0 then
            -- Lever ici annule les réservations déjà faites dans ce bloc.
            raise exception 'place_order_insufficient_stock';
        end if;

        insert into orders (id, tenant_id, user_id, items, total, status, address, created_at, idempotency_key)
        values (p_order_id, p_tenant_id, p_user_id, p_items, p_total, 'PENDING', p_address,
                timezone('utc', now()), p_idempotency_key)
        returning * into v_order;
    exception
        when raise_exception then
            if sqlerrm = 'place_order_insufficient_stock' then
                return jsonb_build_object('status', 'insufficient_stock', 'failures', v_failures);
            end if;
            raise;
        when unique_violation then
            -- Validation simultanée du même panier : l'autre passage a gagné.
            if p_idempotency_key is not null then
                select * into v_existing from orders
                where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
                if found then
                    return jsonb_build_object('status', 'existing', 'order', to_jsonb(v_existing));
                end if;
            end if;
            raise;
    end;

    return jsonb_build_object('status', 'created', 'order', to_jsonb(v_order));
end;
$$;

create or replace function transition_order_status(
    p_tenant_id uuid,
    p_order_id text,
    p_status text,
    p_allowed_from text[] default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
    v_order orders%rowtype;
    v_updated orders%rowtype;
    v_item jsonb;
    v_qty integer;
    v_variations jsonb;
    v_stock record;
    v_failures jsonb := '[]'::jsonb;
    v_from text;
begin
    -- Le verrou sérialise deux annulations simultanées : la seconde voit CANCELLED.
    select * into v_order from orders
    where tenant_id = p_tenant_id and id = p_order_id
    for update;
    if not found then
        return jsonb_build_object('status', 'not_found');
    end if;

    v_from := coalesce(v_order.status, 'PENDING');
    if v_from = p_status then
        return jsonb_build_object('status', 'unchanged', 'from', v_from, 'order', to_jsonb(v_order));
    end if;
    if p_allowed_from is not null and not (v_from = any(p_allowed_from)) then
        return jsonb_build_object('status', 'not_allowed', 'from', v_from, 'order', to_jsonb(v_order));
    end if;

    begin
        if jsonb_typeof(v_order.items) = 'array' and (p_status = 'CANCELLED' or v_from = 'CANCELLED') then
            for v_item in
                select value from jsonb_array_elements(v_order.items) order by value->>'productId'
            loop
                continue when coalesce(v_item->>'productId', '') = '_delivery';
                v_qty := coalesce((v_item->>'quantity')::integer, 0);
                continue when v_qty < 1;
                v_variations := case
                    when jsonb_typeof(v_item->'selectedVariations') = 'array'
                         and jsonb_array_length(v_item->'selectedVariations') > 0
                    then v_item->'selectedVariations' end;

                if p_status = 'CANCELLED' then
                    -- Remise en stock ; un produit supprimé depuis est simplement ignoré.
                    perform adjust_stock(p_tenant_id, v_item->>'productId', v_qty, v_variations);
                else
                    select * into v_stock from adjust_stock(p_tenant_id, v_item->>'productId', -v_qty, v_variations);
                    if not coalesce(v_stock.success, false) then
                        v_failures := v_failures || jsonb_build_array(jsonb_build_object(
                            'productId', v_item->>'productId',
                            'productName', v_item->>'productName',
                            'requested', v_qty,
                            'available', v_stock.available));
                    end if;
                end if;
            end loop;

            if jsonb_array_length(v_failures) > 0 then
                raise exception 'transition_insufficient_stock';
            end if;
        end if;

        update orders set status = p_status
        where tenant_id = p_tenant_id and id = p_order_id
        returning * into v_updated;
    exception
        when raise_exception then
            if sqlerrm = 'transition_insufficient_stock' then
                return jsonb_build_object('status', 'insufficient_stock', 'from', v_from, 'failures', v_failures);
            end if;
            raise;
    end;

    return jsonb_build_object('status', 'updated', 'from', v_from, 'order', to_jsonb(v_updated));
end;
$$;

revoke all on function place_order(uuid, text, text, jsonb, integer, text, text) from public, anon, authenticated;
revoke all on function transition_order_status(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function place_order(uuid, text, text, jsonb, integer, text, text) to service_role;
grant execute on function transition_order_status(uuid, text, text, text[]) to service_role;
