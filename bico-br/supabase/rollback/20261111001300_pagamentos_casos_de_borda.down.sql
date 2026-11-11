do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('bico-expirar-assinaturas');
    perform cron.unschedule('bico-limpeza');
  end if;
end $$;
drop function if exists public.purge_expired_cache();
alter table public.refunds drop constraint if exists refunds_requester;
alter table public.refunds drop column if exists origin;
-- process_payment_update e billing_transition permanecem na versão corrigida (voltar reintroduziria falhas).
