-- ============================================================================
-- adjust_stock : ajustement ATOMIQUE du stock d'un produit (et de ses
-- options de variation) au moment d'une commande.
--
-- POURQUOI : jusqu'ici le stock n'était JAMAIS décrémenté à la commande.
-- Le bot IA « respectait » un stock qui ne bougeait pas → survente garantie.
-- Cette fonction verrouille la ligne produit (FOR UPDATE), vérifie le stock
-- (produit ET option de variation sélectionnée), puis écrit — le tout dans
-- une transaction. Deux clients ne peuvent plus acheter la même dernière pièce.
--
-- USAGE :
--   delta négatif  = décrément (commande)  → vérifie le stock, échoue proprement
--   delta positif  = restock (annulation)  → toujours accepté
--
-- Appelée par backend/src/services/dbService.ts (decrementStockForItems /
-- restockItems), avec un fallback JS non-atomique si cette fonction n'est
-- pas encore déployée.
--
-- À APPLIQUER dans Supabase : SQL Editor → coller ce fichier → Run.
-- ============================================================================

CREATE OR REPLACE FUNCTION adjust_stock(
    p_tenant_id UUID,
    p_product_id TEXT,
    p_delta INT,
    p_variations JSONB DEFAULT NULL  -- [{"name":"Taille","value":"XL"}, ...]
)
RETURNS TABLE(success BOOLEAN, available INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_stock INT;
    v_manage BOOLEAN;
    v_variations JSONB;
    v_qty INT := ABS(p_delta);
    v_is_decrement BOOLEAN := (p_delta < 0);
    v_new_variations JSONB;
    v_variation JSONB;
    v_option JSONB;
    v_new_options JSONB;
    v_sel_value TEXT;
    v_opt_stock INT;
BEGIN
    -- Verrou de ligne : sérialise les commandes concurrentes sur ce produit
    SELECT stock, COALESCE(manage_stock, TRUE), variations
    INTO v_stock, v_manage, v_variations
    FROM products
    WHERE tenant_id = p_tenant_id AND id::text = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::INT;
        RETURN;
    END IF;

    -- Stock non géré (production à la demande) : rien à faire
    IF v_manage = FALSE THEN
        RETURN QUERY SELECT TRUE, NULL::INT;
        RETURN;
    END IF;

    -- ------------------------------------------------------------------
    -- PHASE 1 : VÉRIFICATIONS (décrément uniquement)
    -- ------------------------------------------------------------------
    IF v_is_decrement THEN
        IF v_stock IS NOT NULL AND v_stock < v_qty THEN
            RETURN QUERY SELECT FALSE, v_stock;
            RETURN;
        END IF;

        -- Stock de chaque option de variation sélectionnée
        IF p_variations IS NOT NULL AND v_variations IS NOT NULL THEN
            FOR v_variation IN SELECT * FROM jsonb_array_elements(v_variations) LOOP
                SELECT s->>'value' INTO v_sel_value
                FROM jsonb_array_elements(p_variations) s
                WHERE s->>'name' = v_variation->>'name'
                LIMIT 1;

                IF v_sel_value IS NOT NULL THEN
                    SELECT (o->>'stock')::INT INTO v_opt_stock
                    FROM jsonb_array_elements(v_variation->'options') o
                    WHERE o->>'value' = v_sel_value AND o->>'stock' IS NOT NULL
                    LIMIT 1;

                    IF v_opt_stock IS NOT NULL AND v_opt_stock < v_qty THEN
                        RETURN QUERY SELECT FALSE, v_opt_stock;
                        RETURN;
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END IF;

    -- ------------------------------------------------------------------
    -- PHASE 2 : ÉCRITURE (stock de base + options de variation)
    -- ------------------------------------------------------------------
    IF v_variations IS NOT NULL AND p_variations IS NOT NULL THEN
        v_new_variations := '[]'::jsonb;

        FOR v_variation IN SELECT * FROM jsonb_array_elements(v_variations) LOOP
            SELECT s->>'value' INTO v_sel_value
            FROM jsonb_array_elements(p_variations) s
            WHERE s->>'name' = v_variation->>'name'
            LIMIT 1;

            IF v_sel_value IS NOT NULL THEN
                v_new_options := '[]'::jsonb;
                FOR v_option IN SELECT * FROM jsonb_array_elements(v_variation->'options') LOOP
                    IF v_option->>'value' = v_sel_value AND v_option->>'stock' IS NOT NULL THEN
                        v_option := jsonb_set(
                            v_option,
                            '{stock}',
                            to_jsonb(GREATEST(0, (v_option->>'stock')::INT + p_delta))
                        );
                    END IF;
                    v_new_options := v_new_options || jsonb_build_array(v_option);
                END LOOP;
                v_variation := jsonb_set(v_variation, '{options}', v_new_options);
            END IF;

            v_new_variations := v_new_variations || jsonb_build_array(v_variation);
        END LOOP;
    ELSE
        v_new_variations := v_variations;
    END IF;

    UPDATE products
    SET stock = CASE WHEN stock IS NULL THEN NULL ELSE GREATEST(0, stock + p_delta) END,
        variations = v_new_variations
    WHERE tenant_id = p_tenant_id AND id::text = p_product_id;

    RETURN QUERY SELECT TRUE, v_stock + p_delta;
END;
$$;

-- Le backend l'appelle via supabase.rpc('adjust_stock', ...) avec la clé service_role.
