drop table if exists public.dispute_entries, public.disputes, public.refunds, public.webhook_events,
  public.payments, public.contract_events, public.contracts, public.subscription_events,
  public.freelancer_billing, public.plans, public.platform_settings cascade;
drop sequence if exists public.dispute_protocol_seq;
drop trigger if exists freelancer_profiles_billing on public.freelancer_profiles;
drop function if exists private.create_freelancer_billing();
drop function if exists private.is_contract_party(uuid);
