-- Complément après add_paystack_event_ledger.sql.
-- Supabase peut conserver des GRANT directs à anon/authenticated même après
-- REVOKE ... FROM PUBLIC. Ces fonctions privilégiées restent réservées au backend.

revoke all on function claim_paystack_event(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function complete_paystack_event(uuid, text) from public, anon, authenticated;
revoke all on function fail_paystack_event(uuid, text, text) from public, anon, authenticated;
revoke all on table payment_events from anon, authenticated;

grant execute on function claim_paystack_event(uuid, text, text, jsonb) to service_role;
grant execute on function complete_paystack_event(uuid, text) to service_role;
grant execute on function fail_paystack_event(uuid, text, text) to service_role;

create index if not exists payment_events_tenant_id_idx on payment_events(tenant_id);

alter function adjust_stock(uuid, text, integer, jsonb) set search_path = public;
