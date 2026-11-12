-- Reverte tabelas e colunas. As funções de contrato permanecem na versão desta migration e deixam de
-- funcionar sem as tabelas: esta reversão só é segura em homologação, seguida das reversões anteriores.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then perform cron.unschedule('bico-aprovacao-automatica'); end if;
end $$;
drop function if exists public.mark_payout_paid(uuid, text);
drop function if exists public.auto_approve_deliveries();
drop function if exists private.complete_contract(uuid, uuid, text);
drop function if exists public.request_changes(uuid, text, bigint[]);
drop table if exists public.payouts, public.contract_deliverables cascade;
drop trigger if exists project_skills_cap on public.project_skills;
drop trigger if exists job_skills_cap on public.job_skills;
alter table public.contracts drop constraint if exists contracts_credit_equals_amount;
alter table public.profile_private drop column if exists pix_key;
delete from public.platform_settings where key = 'auto_approve_days';
