drop function if exists public.admin_metrics(integer);
drop function if exists public.resolve_dispute(uuid, text, text);
drop function if exists public.abandon_pro_request();
drop function if exists public.confirm_balance_received(uuid);
drop function if exists public.declare_balance_paid(uuid);
alter table public.payments drop column if exists checkout_url;
alter table public.contracts drop column if exists balance_declared_paid_at, drop column if exists balance_confirmed_at;
delete from public.platform_settings where key = 'payment_model';
-- request_pro permanece na versão desta migration (compatível); os preços dos planos não são desfeitos.
