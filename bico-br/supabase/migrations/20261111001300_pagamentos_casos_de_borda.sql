-- Bico BR — 0013: casos de borda de pagamento + agendamentos
--
-- Problemas corrigidos (encontrados em revisão do próprio código):
--  1. Pagamento de plano aprovado DEPOIS de o usuário desistir da compra: a máquina de estados
--     recusava a transição e o webhook falharia para sempre. Agora dinheiro recebido é honrado:
--     o plano é ativado a partir de qualquer estado em que não haja plano vigente.
--  2. Taxa de serviço aprovada para contrato já cancelado: o dinheiro entrava e nada sinalizava.
--     Agora gera pedido de reembolso automático para análise do financeiro.

create or replace function private.billing_transition(
  p_user uuid, p_to text, p_reason text, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare v_from text;
begin
  select state into v_from from public.freelancer_billing where user_id = p_user for update;
  if not found then
    raise exception 'Freelancer sem registro de assinatura' using errcode = 'P0002';
  end if;
  if not (
    (v_from = 'FREE_UNLIMITED'          and p_to in ('FIRST_PROJECT_ACTIVE')) or
    (v_from = 'FIRST_PROJECT_ACTIVE'    and p_to in ('FIRST_PROJECT_COMPLETED','FREE_UNLIMITED')) or
    (v_from = 'FIRST_PROJECT_COMPLETED' and p_to in ('PRO_PENDING_ACTIVATION','PRO_ACTIVE')) or
    (v_from = 'PRO_PENDING_ACTIVATION'  and p_to in ('PRO_ACTIVE','FIRST_PROJECT_COMPLETED','PRO_EXPIRED')) or
    (v_from = 'PRO_ACTIVE'              and p_to in ('PRO_ACTIVE','PRO_EXPIRED','PRO_CANCELLED')) or
    (v_from = 'PRO_CANCELLED'           and p_to in ('PRO_EXPIRED','PRO_PENDING_ACTIVATION','PRO_ACTIVE')) or
    (v_from = 'PRO_EXPIRED'             and p_to in ('PRO_PENDING_ACTIVATION','PRO_ACTIVE'))
  ) then
    raise exception 'Transição de assinatura inválida: % -> %', v_from, p_to using errcode = 'P0001';
  end if;
  update public.freelancer_billing set state = p_to where user_id = p_user;
  insert into public.subscription_events (user_id, from_state, to_state, reason, metadata)
  values (p_user, v_from, p_to, p_reason, coalesce(p_meta, '{}'));
end $$;

-- pedidos de reembolso abertos pelo próprio sistema não têm solicitante humano
alter table public.refunds alter column requested_by drop not null;
alter table public.refunds add column origin text not null default 'user' check (origin in ('user','system'));
alter table public.refunds add constraint refunds_requester check (origin = 'system' or requested_by is not null);

create or replace function public.process_payment_update(
  p_payment_id uuid, p_provider_payment_id text, p_provider_status text,
  p_status_detail text, p_amount_cents bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  v_new text;
  v_plan public.plans;
  v_bill public.freelancer_billing;
  v_contract_status text;
  v_result text;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then return 'payment_not_found'; end if;

  v_new := case p_provider_status
    when 'approved' then 'approved'
    when 'authorized' then 'in_process'
    when 'in_process' then 'in_process'
    when 'pending' then 'pending'
    when 'rejected' then 'rejected'
    when 'cancelled' then 'cancelled'
    when 'refunded' then 'refunded'
    when 'charged_back' then 'charged_back'
    when 'in_mediation' then 'in_mediation'
    else null end;
  if v_new is null then return 'unknown_status'; end if;

  -- um mesmo registro nosso nunca é associado a dois pagamentos diferentes do provedor
  if pay.provider_payment_id is not null and pay.provider_payment_id <> p_provider_payment_id
     and pay.status in ('approved','refunded','charged_back','in_mediation') then
    return 'provider_id_conflict';
  end if;

  if v_new = 'approved' and p_amount_cents is distinct from pay.amount_cents then
    update public.payments
       set provider_payment_id = p_provider_payment_id, provider_status = p_provider_status,
           provider_status_detail = 'amount_mismatch'
     where id = pay.id;
    return 'amount_mismatch';
  end if;

  if pay.status in ('approved','refunded','charged_back','in_mediation')
     and v_new in ('pending','in_process','rejected','cancelled') then
    return 'ignored_regression';
  end if;
  -- cobrança que nós cancelamos não volta a "pendente" por evento atrasado do provedor
  if pay.status = 'cancelled' and v_new in ('pending','in_process') then
    return 'ignored_cancelled';
  end if;

  update public.payments
     set status = v_new, provider_payment_id = p_provider_payment_id,
         provider_status = p_provider_status, provider_status_detail = p_status_detail,
         paid_at = case when v_new = 'approved' then coalesce(paid_at, now()) else paid_at end
   where id = pay.id;
  v_result := v_new;

  if v_new = 'approved' and pay.status <> 'approved' then
    if pay.kind = 'deposit' then
      select status into v_contract_status from public.contracts where id = pay.contract_id for update;
      if v_contract_status = 'awaiting_deposit' then
        perform private.activate_contract(pay.contract_id, null);
      else
        -- contrato não está mais aguardando a taxa (ex.: cancelado): o valor deve ser devolvido
        insert into public.refunds (payment_id, amount_cents, reason, origin)
        values (pay.id, pay.amount_cents,
                'Pagamento confirmado para contrato em estado "' || v_contract_status || '". Devolução automática para análise.', 'system');
        insert into public.contract_events (contract_id, event, note)
        values (pay.contract_id, 'payment_needs_refund', 'Pagamento recebido fora do fluxo; reembolso aberto para o financeiro');
        v_result := 'approved_needs_refund';
      end if;
    elsif pay.kind = 'subscription' then
      select * into v_plan from public.plans where id = pay.plan_id;
      select * into v_bill from public.freelancer_billing where user_id = pay.payer_id for update;
      if v_bill.state in ('FIRST_PROJECT_COMPLETED','PRO_PENDING_ACTIVATION','PRO_EXPIRED','PRO_CANCELLED')
         or (v_bill.state = 'PRO_ACTIVE' and v_bill.cycle_end <= now()) then
        perform private.billing_transition(pay.payer_id, 'PRO_ACTIVE', 'payment_approved',
          jsonb_build_object('payment_id', pay.id, 'plan_code', v_plan.code));
        update public.freelancer_billing
           set plan_id = v_plan.id, cycle_start = now(),
               cycle_end = now() + make_interval(days => v_plan.cycle_days), proposals_used = 0
         where user_id = pay.payer_id;
      else
        -- já há plano vigente (ou o usuário nem é elegível): não sobrepõe; devolve
        insert into public.refunds (payment_id, amount_cents, reason, origin)
        values (pay.id, pay.amount_cents,
                'Pagamento de plano confirmado com assinatura no estado "' || v_bill.state || '". Devolução automática para análise.', 'system');
        v_result := 'approved_needs_refund';
      end if;
    end if;
  elsif v_new in ('rejected','cancelled') and pay.kind = 'subscription' then
    if (select state from public.freelancer_billing where user_id = pay.payer_id) = 'PRO_PENDING_ACTIVATION'
       and not exists (select 1 from public.payments o where o.payer_id = pay.payer_id and o.kind = 'subscription'
                        and o.id <> pay.id and o.status in ('pending','in_process')) then
      perform private.billing_transition(pay.payer_id,
        case when exists (select 1 from public.subscription_events e
                           where e.user_id = pay.payer_id and e.to_state = 'PRO_ACTIVE')
             then 'PRO_EXPIRED' else 'FIRST_PROJECT_COMPLETED' end,
        'payment_' || v_new, jsonb_build_object('payment_id', pay.id));
    end if;
  elsif v_new in ('refunded','charged_back','in_mediation') and pay.contract_id is not null then
    insert into public.contract_events (contract_id, event, note)
    values (pay.contract_id, 'payment_' || v_new, 'Requer análise da equipe financeira');
  end if;
  return v_result;
end $$;
revoke all on function public.process_payment_update(uuid, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.process_payment_update(uuid, text, text, text, bigint) to service_role;

-- pedidos automáticos aparecem para o financeiro (política existente cobre: has_admin_role finance)

-- ---------------------------------------------------------------- manutenção agendada
create or replace function public.purge_expired_cache()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.registry_cache where expires_at < now();
  get diagnostics n = row_count;
  delete from public.external_api_logs where created_at < now() - interval '90 days';
  delete from public.webhook_events where processed_at is not null and received_at < now() - interval '180 days';
  delete from public.notifications where read_at is not null and created_at < now() - interval '180 days';
  return n;
end $$;
revoke all on function public.purge_expired_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_cache() to service_role;

-- No Supabase, habilite a extensão pg_cron (Database > Extensions) ANTES desta migration para
-- que os agendamentos sejam criados. Sem ela, a migration apenas avisa.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('bico-expirar-assinaturas', '7 * * * *', 'select public.expire_subscriptions()');
    perform cron.schedule('bico-limpeza', '23 4 * * *', 'select public.purge_expired_cache()');
  else
    raise notice 'pg_cron ausente: agende expire_subscriptions() (de hora em hora) e purge_expired_cache() (diário) manualmente.';
  end if;
end $$;
