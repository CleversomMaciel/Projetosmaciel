-- Reverte tabelas e colunas novas. As funções de pagamento/contrato permanecem nesta versão.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('bico-aviso-vencimento'); end if;
end $$;
drop function if exists public.notify_expiring_subscriptions();
drop function if exists public.redeem_coupon(text);
drop function if exists private.apply_pending_trial(uuid);
drop table if exists public.coupon_redemptions, public.coupons cascade;
alter table public.freelancer_billing drop column if exists trial_days_pending;
alter table public.freelancer_profiles drop column if exists mp_connected;
drop table if exists public.mp_accounts cascade;
update public.categories set is_active = true;
update public.skills set is_active = true;
grant insert (company_id, created_by, title, description, category_id, requirements, contract_type, salary_min_cents, salary_max_cents, workload, benefits, experience_level, company_city, company_uf, application_deadline, selection_process, apply_mode, apply_url, status) on public.jobs to authenticated;
