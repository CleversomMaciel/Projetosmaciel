-- Bico BR — 0012: decisões do modelo comercial + operações administrativas
--
-- DECISÕES REGISTRADAS (podem ser revistas; ver docs/05-pendencias-e-decisoes.md):
--  D1. A entrada de 10% É a taxa de serviço da plataforma, paga pela empresa ao fechar o contrato.
--  D2. O saldo (90%) é pago pela empresa DIRETAMENTE ao profissional, fora da plataforma.
--      A plataforma não recebe, não guarda e não repassa dinheiro de terceiros (sem custódia, sem split).
--      O sistema apenas registra a declaração de pagamento e a confirmação de recebimento.
--  D3. Planos Pro são pagamentos avulsos por ciclo de 30 dias, SEM renovação automática:
--      nenhuma cobrança acontece sem uma nova ação e um novo aceite do profissional.
--  D4. Preços de lançamento definidos abaixo (alteráveis pelo financeiro no painel).

insert into public.platform_settings (key, value, description, is_public) values
  ('payment_model', '{"deposit_is_platform_fee": true, "balance_settlement": "direct", "subscription_auto_renew": false}',
   'Modelo comercial vigente: entrada = taxa de serviço; saldo pago direto ao profissional; planos sem renovação automática.', true)
on conflict (key) do nothing;

update public.plans set price_cents = 2990, is_active = true where code = 'pro' and price_cents is null;
update public.plans set price_cents = 5990, is_active = true where code = 'pro_plus' and price_cents is null;
update public.plans set price_cents = 9990, is_active = true where code = 'premium' and price_cents is null;

-- ---------------------------------------------------------------- saldo pago direto
alter table public.contracts
  add column balance_declared_paid_at timestamptz,
  add column balance_confirmed_at timestamptz;
alter table public.payments add column checkout_url text check (char_length(checkout_url) <= 1000);

create or replace function public.declare_balance_paid(p_contract_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.company_user_id is distinct from v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'completed' or c.balance_declared_paid_at is not null then
    raise exception 'O saldo só pode ser declarado uma vez, após a aprovação da entrega' using errcode = 'P0001';
  end if;
  update public.contracts set balance_declared_paid_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, note)
  values (c.id, v_uid, 'balance_declared_paid', 'Empresa declarou ter pago o saldo diretamente ao profissional');
  perform private.notify(c.freelancer_id, 'balance_declared_paid', jsonb_build_object('contract_id', c.id));
end $$;

create or replace function public.confirm_balance_received(p_contract_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.freelancer_id is distinct from v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'completed' or c.balance_confirmed_at is not null then
    raise exception 'Não há saldo pendente de confirmação' using errcode = 'P0001';
  end if;
  update public.contracts set balance_confirmed_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, note)
  values (c.id, v_uid, 'balance_confirmed', 'Profissional confirmou o recebimento do saldo');
  perform private.notify(c.company_user_id, 'balance_confirmed', jsonb_build_object('contract_id', c.id));
end $$;

-- ---------------------------------------------------------------- Pro: compra por ciclo, sem renovação automática
-- Reescreve request_pro: trata ciclo vencido ainda não processado pelo agendador e impede
-- cobranças pendentes duplicadas.
create or replace function public.request_pro(p_plan_code text, p_accept boolean)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_plan public.plans;
  v_bill public.freelancer_billing;
  v_pay public.payments;
begin
  if p_accept is not true then
    raise exception 'É necessário aceitar expressamente o preço e as condições do plano'
      using errcode = 'P0001', detail = 'CONSENT_REQUIRED';
  end if;
  select * into v_bill from public.freelancer_billing where user_id = v_uid for update;
  if not found then
    raise exception 'Apenas freelancers podem assinar o Pro' using errcode = '42501';
  end if;
  if v_bill.state in ('PRO_ACTIVE','PRO_CANCELLED') and v_bill.cycle_end <= now() then
    perform private.billing_transition(v_uid, 'PRO_EXPIRED', 'cycle_ended');
    v_bill.state := 'PRO_EXPIRED';
  end if;
  if v_bill.state = 'PRO_PENDING_ACTIVATION' then
    -- já existe uma compra aguardando pagamento: devolve a mesma (nunca gera cobrança em dobro)
    select * into v_pay from public.payments
     where payer_id = v_uid and kind = 'subscription' and status in ('pending','in_process')
     order by created_at desc limit 1;
    if found then return v_pay; end if;
  end if;
  if v_bill.state not in ('FIRST_PROJECT_COMPLETED','PRO_EXPIRED','PRO_CANCELLED') then
    raise exception 'A assinatura não está disponível no estado atual (%)', v_bill.state
      using errcode = 'P0001', detail = 'STATE_NOT_ELIGIBLE';
  end if;
  select * into v_plan from public.plans
   where code = p_plan_code and audience = 'freelancer' and is_active and price_cents is not null;
  if not found then
    raise exception 'Plano indisponível' using errcode = 'P0002';
  end if;

  update public.freelancer_billing
     set plan_id = v_plan.id, consent_at = now(),
         consent_snapshot = jsonb_build_object(
           'plan_code', v_plan.code, 'plan_name', v_plan.name, 'price_cents', v_plan.price_cents,
           'proposals_per_cycle', v_plan.proposals_per_cycle, 'cycle_days', v_plan.cycle_days,
           'auto_renew', false)
   where user_id = v_uid;
  perform private.billing_transition(v_uid, 'PRO_PENDING_ACTIVATION', 'consent_given',
    jsonb_build_object('plan_code', v_plan.code, 'price_cents', v_plan.price_cents));

  insert into public.payments (kind, plan_id, payer_id, amount_cents)
  values ('subscription', v_plan.id, v_uid, v_plan.price_cents)
  returning * into v_pay;
  return v_pay;
end $$;

-- desistir de uma compra ainda não paga
create or replace function public.abandon_pro_request()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_state text;
begin
  select state into v_state from public.freelancer_billing where user_id = v_uid for update;
  if v_state is distinct from 'PRO_PENDING_ACTIVATION' then
    raise exception 'Não há compra pendente' using errcode = 'P0001';
  end if;
  update public.payments set status = 'cancelled'
   where payer_id = v_uid and kind = 'subscription' and status = 'pending';
  perform private.billing_transition(v_uid,
    case when exists (select 1 from public.subscription_events e where e.user_id = v_uid and e.to_state = 'PRO_ACTIVE')
         then 'PRO_EXPIRED' else 'FIRST_PROJECT_COMPLETED' end, 'user_abandoned');
end $$;

-- ---------------------------------------------------------------- disputas: decisão administrativa
create or replace function public.resolve_dispute(p_dispute_id uuid, p_resolution text, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); d public.disputes; c public.contracts; v_new text;
begin
  if not private.has_admin_role('{support}') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_outcome not in ('resume','complete','cancel') or char_length(coalesce(p_resolution, '')) < 20 then
    raise exception 'Informe o desfecho e uma justificativa com pelo menos 20 caracteres' using errcode = 'P0001';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found or d.status in ('resolved','closed') then
    raise exception 'Disputa não encontrada ou já encerrada' using errcode = 'P0002';
  end if;
  select * into c from public.contracts where id = d.contract_id for update;
  update public.disputes set status = 'resolved', resolution = p_resolution, resolved_by = v_uid, resolved_at = now()
   where id = d.id;
  if c.status = 'disputed' then
    v_new := case p_outcome when 'resume' then coalesce(d.previous_contract_status, 'active')
                            when 'complete' then 'completed' else 'cancelled' end;
    update public.contracts
       set status = v_new,
           completed_at = case when v_new = 'completed' then now() else completed_at end,
           cancelled_at = case when v_new = 'cancelled' then now() else cancelled_at end,
           cancel_reason = case when v_new = 'cancelled' then 'Encerrado por decisão da disputa ' || d.protocol else cancel_reason end
     where id = c.id;
    if v_new = 'completed' then
      update public.freelancer_profiles set completed_projects = completed_projects + 1 where user_id = c.freelancer_id;
      if (select state from public.freelancer_billing where user_id = c.freelancer_id) = 'FIRST_PROJECT_ACTIVE' then
        perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_COMPLETED', 'first_contract_completed',
          jsonb_build_object('contract_id', c.id, 'via', 'dispute'));
      end if;
    elsif v_new = 'cancelled' and c.is_first_bico
          and (select state from public.freelancer_billing where user_id = c.freelancer_id) = 'FIRST_PROJECT_ACTIVE'
          and not exists (select 1 from public.contracts k where k.freelancer_id = c.freelancer_id
                           and k.id <> c.id and k.status in ('active','delivered','disputed')) then
      -- primeiro bico cancelado não consome o benefício do primeiro projeto gratuito
      perform private.billing_transition(c.freelancer_id, 'FREE_UNLIMITED', 'first_contract_cancelled',
        jsonb_build_object('contract_id', c.id));
    end if;
  end if;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, null, 'dispute_resolved', c.status, coalesce(v_new, c.status), d.protocol || ': ' || p_resolution);
  perform private.notify(c.freelancer_id, 'dispute_resolved', jsonb_build_object('contract_id', c.id, 'protocol', d.protocol));
  perform private.notify(c.company_user_id, 'dispute_resolved', jsonb_build_object('contract_id', c.id, 'protocol', d.protocol));
end $$;

-- ---------------------------------------------------------------- indicadores (somente financeiro, com MFA)
create or replace function public.admin_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_since timestamptz := now() - make_interval(days => least(greatest(p_days, 1), 365));
begin
  if not private.has_admin_role('{finance}') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'periodo_dias', least(greatest(p_days, 1), 365),
    'cadastros_empresas', (select count(*) from public.profiles where account_type = 'company' and created_at >= v_since),
    'cadastros_freelancers', (select count(*) from public.profiles where account_type = 'freelancer' and created_at >= v_since),
    'empresas_ativas', (select count(distinct company_id) from public.projects where created_at >= v_since),
    'projetos_publicados', (select count(*) from public.projects where published_at >= v_since),
    'vagas_publicadas', (select count(*) from public.jobs where published_at >= v_since),
    'propostas_enviadas', (select count(*) from public.proposals where created_at >= v_since),
    'contratos_iniciados', (select count(*) from public.contracts where started_at >= v_since),
    'contratos_concluidos', (select count(*) from public.contracts where completed_at >= v_since),
    'taxa_conversao_projeto_contrato', (
      select case when count(*) = 0 then null
                  else round(count(*) filter (where exists (select 1 from public.contracts c where c.project_id = p.id and c.started_at is not null))::numeric / count(*), 4) end
        from public.projects p where p.published_at >= v_since),
    -- GMV: valor total dos contratos iniciados (não é receita)
    'gmv_centavos', (select coalesce(sum(amount_cents), 0) from public.contracts where started_at >= v_since),
    'ticket_medio_centavos', (select coalesce(round(avg(amount_cents)), 0) from public.contracts where started_at >= v_since),
    -- receita bruta: só o que a plataforma efetivamente recebeu
    'receita_taxa_servico_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where kind = 'deposit' and status = 'approved' and paid_at >= v_since),
    'receita_assinaturas_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where kind = 'subscription' and status = 'approved' and paid_at >= v_since),
    'estornos_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where status in ('refunded','charged_back') and updated_at >= v_since),
    'assinantes_ativos', (select count(*) from public.freelancer_billing where state = 'PRO_ACTIVE' and cycle_end > now()),
    'disputas_abertas', (select count(*) from public.disputes where status not in ('resolved','closed')),
    'disputas_no_periodo', (select count(*) from public.disputes where created_at >= v_since),
    'reembolsos_pendentes', (select count(*) from public.refunds where status = 'requested'),
    'denuncias_abertas', (select count(*) from public.reports where status in ('open','in_review')),
    'saldos_sem_confirmacao', (select count(*) from public.contracts where status = 'completed' and balance_confirmed_at is null and completed_at < now() - interval '7 days')
  );
end $$;

revoke all on function public.declare_balance_paid(uuid), public.confirm_balance_received(uuid),
  public.request_pro(text, boolean), public.abandon_pro_request(), public.resolve_dispute(uuid, text, text),
  public.admin_metrics(integer) from public, anon;
grant execute on function public.declare_balance_paid(uuid), public.confirm_balance_received(uuid),
  public.request_pro(text, boolean), public.abandon_pro_request(), public.resolve_dispute(uuid, text, text),
  public.admin_metrics(integer) to authenticated, service_role;

-- moderação pode ver propostas/projetos denunciados; suporte e moderação enxergam todos os perfis de empresa
-- (políticas já existentes cobrem; nada novo aqui)
