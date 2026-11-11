drop table if exists public.referrals, public.referral_codes, public.external_api_logs,
  public.registry_cache, public.data_subject_requests, public.consents, public.legal_documents cascade;
drop trigger if exists audit_contracts on public.contracts;
drop trigger if exists audit_payments on public.payments;
drop trigger if exists audit_refunds on public.refunds;
drop trigger if exists audit_disputes on public.disputes;
drop trigger if exists audit_billing on public.freelancer_billing;
drop trigger if exists audit_plans on public.plans;
drop trigger if exists audit_settings on public.platform_settings;
drop trigger if exists audit_admins on public.admin_members;
drop table if exists public.audit_logs cascade;
drop function if exists private.audit_row();
drop function if exists private.audit_immutable();
