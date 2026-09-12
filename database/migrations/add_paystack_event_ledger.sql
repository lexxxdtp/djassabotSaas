-- Registre durable des webhooks Paystack.
-- À appliquer AVANT de déployer le code qui utilise claim_paystack_event.

create table if not exists payment_events (
    provider text not null,
    reference text not null,
    tenant_id uuid not null references tenants(id) on delete cascade,
    event_type text not null,
    status text not null check (status in ('processing', 'completed', 'failed')),
    payload jsonb not null default '{}'::jsonb,
    claimed_at timestamptz not null default now(),
    completed_at timestamptz,
    last_error text,
    created_at timestamptz not null default now(),
    primary key (provider, reference)
);

alter table payment_events enable row level security;

-- Une référence de paiement ne peut créer qu'un abonnement, même si le processus
-- tombe après l'insertion mais avant d'avoir acquitté le webhook.
alter table subscriptions add column if not exists paystack_reference text;
create unique index if not exists subscriptions_paystack_reference_unique
    on subscriptions(paystack_reference)
    where paystack_reference is not null;

create or replace function claim_paystack_event(
    p_tenant_id uuid,
    p_reference text,
    p_event_type text,
    p_payload jsonb default '{}'::jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status text;
    v_tenant_id uuid;
    v_claimed_at timestamptz;
begin
    insert into payment_events(provider, reference, tenant_id, event_type, status, payload)
    values ('paystack', p_reference, p_tenant_id, p_event_type, 'processing', coalesce(p_payload, '{}'::jsonb))
    on conflict (provider, reference) do nothing;

    if found then
        return 'claimed';
    end if;

    select status, tenant_id, claimed_at
      into v_status, v_tenant_id, v_claimed_at
      from payment_events
     where provider = 'paystack' and reference = p_reference
     for update;

    if v_tenant_id <> p_tenant_id then
        raise exception 'Paystack reference already belongs to another tenant';
    end if;

    if v_status = 'completed' then
        return 'completed';
    end if;

    -- Une erreur explicitement enregistrée est rejouable immédiatement. Un worker
    -- disparu peut être repris après cinq minutes.
    if v_status = 'failed' or v_claimed_at < now() - interval '5 minutes' then
        update payment_events
           set status = 'processing', claimed_at = now(), completed_at = null,
               last_error = null, event_type = p_event_type,
               payload = coalesce(p_payload, '{}'::jsonb)
         where provider = 'paystack' and reference = p_reference;
        return 'claimed';
    end if;

    return 'processing';
end;
$$;

create or replace function complete_paystack_event(p_tenant_id uuid, p_reference text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update payment_events
       set status = 'completed', completed_at = now(), last_error = null
     where provider = 'paystack' and reference = p_reference and tenant_id = p_tenant_id;
    if not found then raise exception 'Paystack event not found'; end if;
end;
$$;

create or replace function fail_paystack_event(p_tenant_id uuid, p_reference text, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update payment_events
       set status = 'failed', last_error = left(coalesce(p_error, 'unknown error'), 1000)
     where provider = 'paystack' and reference = p_reference and tenant_id = p_tenant_id;
    if not found then raise exception 'Paystack event not found'; end if;
end;
$$;

revoke all on function claim_paystack_event(uuid, text, text, jsonb) from public;
revoke all on function complete_paystack_event(uuid, text) from public;
revoke all on function fail_paystack_event(uuid, text, text) from public;
grant execute on function claim_paystack_event(uuid, text, text, jsonb) to service_role;
grant execute on function complete_paystack_event(uuid, text) to service_role;
grant execute on function fail_paystack_event(uuid, text, text) to service_role;
