-- Remove apenas dados iniciais que não estejam em uso.
delete from public.platform_settings where key in ('deposit_rate','contract_terms_version','proposal_abuse_daily_limit');
delete from public.plans p where code in ('pro','pro_plus','premium')
  and not exists (select 1 from public.freelancer_billing b where b.plan_id = p.id)
  and not exists (select 1 from public.payments y where y.plan_id = p.id);
