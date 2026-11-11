-- Bico BR — 0007: regras de negócio no banco (RPCs). Toda transição sensível acontece aqui,
-- em transação, e não no frontend.

create or replace function private.setting(p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select value from public.platform_settings where key = p_key;
$$;

create or replace function private.notify(p_user uuid, p_type text, p_payload jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, p_payload);
$$;

-- ---------------------------------------------------------------- assinatura: máquina de estados
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
    (v_from = 'FIRST_PROJECT_COMPLETED' and p_to in ('PRO_PENDING_ACTIVATION')) or
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

-- ---------------------------------------------------------------- enviar proposta (com cota)
create or replace function public.submit_proposal(
  p_project_id uuid, p_amount_cents bigint, p_deadline_days integer, p_cover_letter text,
  p_relevant_experience text default null, p_portfolio_links jsonb default '[]',
  p_extra_terms text default null)
returns public.proposals language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_project public.projects;
  v_bill public.freelancer_billing;
  v_quota integer;
  v_daily_limit integer := (private.setting('proposal_abuse_daily_limit') #>> '{}')::integer;
  v_today integer;
  v_row public.proposals;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  select * into v_bill from public.freelancer_billing where user_id = v_uid for update;
  if not found then
    raise exception 'Apenas freelancers podem enviar propostas' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found or v_project.status <> 'open' then
    raise exception 'Projeto indisponível para propostas' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.companies c where c.id = v_project.company_id and c.owner_id = v_uid) then
    raise exception 'Você não pode enviar proposta para o próprio projeto' using errcode = '42501';
  end if;

  -- teto antiabuso (não é limite comercial): protege empresas contra spam
  if v_daily_limit is not null then
    select count(*) into v_today from public.proposals
     where freelancer_id = v_uid and created_at > now() - interval '24 hours';
    if v_today >= v_daily_limit then
      raise exception 'Limite diário de segurança atingido. Tente novamente amanhã.'
        using errcode = 'P0001', detail = 'ABUSE_LIMIT';
    end if;
  end if;

  if v_bill.state in ('FREE_UNLIMITED','FIRST_PROJECT_ACTIVE') then
    null; -- propostas ilimitadas até a conclusão do primeiro projeto
  elsif v_bill.state in ('PRO_ACTIVE','PRO_CANCELLED')
        and v_bill.cycle_end is not null and v_bill.cycle_end > now() then
    select proposals_per_cycle into v_quota from public.plans where id = v_bill.plan_id;
    if v_quota is not null and v_bill.proposals_used >= v_quota then
      raise exception 'Você usou todas as propostas do ciclo atual'
        using errcode = 'P0001', detail = 'QUOTA_EXCEEDED';
    end if;
    update public.freelancer_billing set proposals_used = proposals_used + 1 where user_id = v_uid;
  else
    raise exception 'Para enviar novas propostas é necessário um plano Bico BR Pro ativo'
      using errcode = 'P0001', detail = 'PRO_REQUIRED';
  end if;

  insert into public.proposals (project_id, freelancer_id, amount_cents, deadline_days,
                                cover_letter, relevant_experience, portfolio_links, extra_terms)
  values (p_project_id, v_uid, p_amount_cents, p_deadline_days, p_cover_letter,
          p_relevant_experience, coalesce(p_portfolio_links, '[]'), p_extra_terms)
  returning * into v_row;

  update public.projects set proposals_count = proposals_count + 1 where id = p_project_id;
  perform private.notify(v_project.created_by, 'proposal_received',
    jsonb_build_object('project_id', p_project_id, 'proposal_id', v_row.id));
  return v_row;
end $$;

-- ---------------------------------------------------------------- aderir ao Pro (consentimento expresso)
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
           'proposals_per_cycle', v_plan.proposals_per_cycle, 'cycle_days', v_plan.cycle_days)
   where user_id = v_uid;
  perform private.billing_transition(v_uid, 'PRO_PENDING_ACTIVATION', 'consent_given',
    jsonb_build_object('plan_code', v_plan.code, 'price_cents', v_plan.price_cents));

  insert into public.payments (kind, plan_id, payer_id, amount_cents)
  values ('subscription', v_plan.id, v_uid, v_plan.price_cents)
  returning * into v_pay;
  return v_pay;
end $$;

create or replace function public.cancel_pro()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- benefícios permanecem até o fim do ciclo já pago; contratos ativos não são afetados
  perform private.billing_transition((select auth.uid()), 'PRO_CANCELLED', 'user_cancelled');
end $$;

-- executada por agendador (service_role)
create or replace function public.expire_subscriptions()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select user_id from public.freelancer_billing
            where state in ('PRO_ACTIVE','PRO_CANCELLED') and cycle_end <= now()
  loop
    perform private.billing_transition(r.user_id, 'PRO_EXPIRED', 'cycle_ended');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- contrato
create or replace function public.accept_proposal(p_proposal_id uuid)
returns public.contracts language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prop public.proposals;
  v_project public.projects;
  v_rate numeric := coalesce((private.setting('deposit_rate') #>> '{}')::numeric, 0);
  v_terms text := coalesce(private.setting('contract_terms_version') #>> '{}', 'rascunho');
  v_deposit bigint;
  v_contract public.contracts;
begin
  select * into v_prop from public.proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposta não encontrada' using errcode = 'P0002'; end if;
  select * into v_project from public.projects where id = v_prop.project_id for update;
  if not private.owns_company(v_project.company_id) then
    raise exception 'Somente a empresa dona do projeto pode aceitar propostas' using errcode = '42501';
  end if;
  if v_prop.status not in ('sent','shortlisted') or v_project.status <> 'open' then
    raise exception 'Proposta ou projeto não estão mais disponíveis' using errcode = 'P0001';
  end if;

  v_deposit := round(v_prop.amount_cents * v_rate);
  update public.proposals set status = 'accepted' where id = p_proposal_id;
  insert into public.contracts (project_id, proposal_id, company_id, company_user_id, freelancer_id,
      scope, deliverables, amount_cents, deposit_rate, deposit_cents, balance_cents,
      deadline_days, terms_version)
  values (v_project.id, v_prop.id, v_project.company_id, v_uid, v_prop.freelancer_id,
      v_project.description, v_project.deliverables, v_prop.amount_cents, v_rate, v_deposit,
      v_prop.amount_cents - v_deposit, v_prop.deadline_days, v_terms)
  returning * into v_contract;
  insert into public.contract_events (contract_id, actor_id, event, to_status)
  values (v_contract.id, v_uid, 'proposal_accepted', v_contract.status);
  perform private.notify(v_prop.freelancer_id, 'proposal_accepted',
    jsonb_build_object('contract_id', v_contract.id, 'project_id', v_project.id));
  return v_contract;
end $$;

create or replace function private.activate_contract(p_contract_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.contracts; v_state text;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if c.status <> 'awaiting_deposit' then return; end if;
  select state into v_state from public.freelancer_billing where user_id = c.freelancer_id for update;
  update public.contracts
     set status = 'active', started_at = now(),
         due_at = now() + make_interval(days => c.deadline_days),
         is_first_bico = (v_state = 'FREE_UNLIMITED')
   where id = c.id;
  if v_state = 'FREE_UNLIMITED' then
    perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_ACTIVE', 'first_contract_started',
      jsonb_build_object('contract_id', c.id));
  end if;
  -- fecha o projeto para novas propostas quando as vagas de profissionais forem preenchidas
  update public.projects p set status = 'in_progress'
   where p.id = c.project_id and p.status = 'open'
     and (select count(*) from public.contracts k
           where k.project_id = p.id and k.status in ('active','delivered','completed'))
         >= p.professionals_wanted;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, p_actor, 'contract_started', 'awaiting_deposit', 'active');
  perform private.notify(c.freelancer_id, 'contract_started', jsonb_build_object('contract_id', c.id));
  perform private.notify(c.company_user_id, 'contract_started', jsonb_build_object('contract_id', c.id));
end $$;

-- freelancer confirma o contrato; gera a cobrança da entrada (ainda pendente)
create or replace function public.confirm_contract(p_contract_id uuid)
returns public.contracts language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.freelancer_id <> v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'awaiting_freelancer' then
    raise exception 'Contrato não está aguardando confirmação' using errcode = 'P0001';
  end if;
  update public.contracts set status = 'awaiting_deposit', freelancer_accepted_at = now()
   where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, v_uid, 'freelancer_confirmed', 'awaiting_freelancer', 'awaiting_deposit');
  if c.deposit_cents > 0 then
    insert into public.payments (kind, contract_id, payer_id, amount_cents)
    values ('deposit', c.id, c.company_user_id, c.deposit_cents);
    perform private.notify(c.company_user_id, 'deposit_due', jsonb_build_object('contract_id', c.id));
  else
    perform private.activate_contract(c.id, v_uid);
  end if;
  select * into c from public.contracts where id = p_contract_id;
  return c;
end $$;

create or replace function public.deliver_contract(
  p_contract_id uuid, p_note text, p_attachments jsonb default '[]')
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.freelancer_id <> v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'active' then
    raise exception 'Contrato não está em execução' using errcode = 'P0001';
  end if;
  update public.contracts set status = 'delivered', delivered_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note, attachments)
  values (c.id, v_uid, 'delivered', 'active', 'delivered', p_note, coalesce(p_attachments, '[]'));
  perform private.notify(c.company_user_id, 'contract_delivered', jsonb_build_object('contract_id', c.id));
end $$;

-- empresa pede ajustes: volta para execução
create or replace function public.request_changes(p_contract_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.company_user_id <> v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'delivered' then
    raise exception 'Não há entrega pendente de análise' using errcode = 'P0001';
  end if;
  update public.contracts set status = 'active' where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, v_uid, 'changes_requested', 'delivered', 'active', p_note);
  perform private.notify(c.freelancer_id, 'changes_requested', jsonb_build_object('contract_id', c.id));
end $$;

create or replace function public.approve_delivery(p_contract_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts; v_state text;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.company_user_id <> v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'delivered' then
    raise exception 'Não há entrega pendente de aprovação' using errcode = 'P0001';
  end if;
  update public.contracts set status = 'completed', completed_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, v_uid, 'approved', 'delivered', 'completed');
  update public.freelancer_profiles set completed_projects = completed_projects + 1
   where user_id = c.freelancer_id;

  select state into v_state from public.freelancer_billing where user_id = c.freelancer_id for update;
  if v_state = 'FIRST_PROJECT_ACTIVE' then
    perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_COMPLETED',
      'first_contract_completed', jsonb_build_object('contract_id', c.id));
    perform private.notify(c.freelancer_id, 'pro_offer', jsonb_build_object('contract_id', c.id));
  end if;

  update public.projects p set status = 'completed'
   where p.id = c.project_id and p.status = 'in_progress'
     and not exists (select 1 from public.contracts k where k.project_id = p.id
                      and k.status in ('awaiting_freelancer','awaiting_deposit','active','delivered','disputed'));
  update public.referrals set status = 'qualified', qualified_contract_id = c.id
   where status = 'pending' and referred_id in (c.freelancer_id, c.company_user_id);
  perform private.notify(c.freelancer_id, 'contract_completed', jsonb_build_object('contract_id', c.id));
end $$;

-- cancelamento antes do início: sem penalidade automática. Depois do início, vira disputa
-- ou acordo analisado por pessoa (nada de multa/retenção automática).
create or replace function public.cancel_contract(p_contract_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or v_uid not in (c.freelancer_id, c.company_user_id) then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status not in ('awaiting_freelancer','awaiting_deposit') then
    raise exception 'Contrato já iniciado: abra uma solicitação na Central de Confiança'
      using errcode = 'P0001', detail = 'USE_DISPUTE';
  end if;
  update public.contracts set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = c.id;
  update public.payments set status = 'cancelled'
   where contract_id = c.id and status = 'pending';
  update public.proposals set status = 'sent' where id = c.proposal_id and v_uid = c.company_user_id;
  update public.proposals set status = 'withdrawn' where id = c.proposal_id and v_uid = c.freelancer_id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, v_uid, 'cancelled', c.status, 'cancelled', p_reason);
end $$;

create or replace function public.open_dispute(p_contract_id uuid, p_reason text, p_description text)
returns public.disputes language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts; d public.disputes; v_other uuid;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or v_uid not in (c.freelancer_id, c.company_user_id) then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status not in ('active','delivered','completed') then
    raise exception 'Este contrato não permite abertura de disputa no estado atual' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.disputes where contract_id = c.id
              and status not in ('resolved','closed')) then
    raise exception 'Já existe uma disputa em andamento para este contrato' using errcode = 'P0001';
  end if;
  insert into public.disputes (contract_id, opened_by, reason, description, previous_contract_status)
  values (c.id, v_uid, p_reason, p_description, c.status) returning * into d;
  if c.status <> 'completed' then
    update public.contracts set status = 'disputed' where id = c.id;
  end if;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, v_uid, 'dispute_opened', c.status,
          case when c.status = 'completed' then 'completed' else 'disputed' end, d.protocol);
  v_other := case when v_uid = c.freelancer_id then c.company_user_id else c.freelancer_id end;
  perform private.notify(v_other, 'dispute_opened',
    jsonb_build_object('contract_id', c.id, 'protocol', d.protocol));
  return d;
end $$;

-- ---------------------------------------------------------------- pagamento confirmado por webhook
-- Só o backend (service_role) chama, depois de validar a assinatura do webhook e de
-- consultar o pagamento diretamente na API do provedor.
create or replace function public.process_payment_update(
  p_payment_id uuid, p_provider_payment_id text, p_provider_status text,
  p_status_detail text, p_amount_cents bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments;
  v_new text;
  v_plan public.plans;
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

  if v_new = 'approved' and p_amount_cents is distinct from pay.amount_cents then
    update public.payments
       set provider_payment_id = p_provider_payment_id, provider_status = p_provider_status,
           provider_status_detail = 'amount_mismatch'
     where id = pay.id;
    return 'amount_mismatch';
  end if;

  -- estados finais posteriores à aprovação não regridem para pendente
  if pay.status in ('approved','refunded','charged_back','in_mediation')
     and v_new in ('pending','in_process','rejected','cancelled') then
    return 'ignored_regression';
  end if;

  update public.payments
     set status = v_new, provider_payment_id = p_provider_payment_id,
         provider_status = p_provider_status, provider_status_detail = p_status_detail,
         paid_at = case when v_new = 'approved' then coalesce(paid_at, now()) else paid_at end
   where id = pay.id;

  if v_new = 'approved' and pay.status <> 'approved' then
    if pay.kind = 'deposit' then
      perform private.activate_contract(pay.contract_id, null);
    elsif pay.kind = 'subscription' then
      select * into v_plan from public.plans where id = pay.plan_id;
      perform private.billing_transition(pay.payer_id, 'PRO_ACTIVE', 'payment_approved',
        jsonb_build_object('payment_id', pay.id, 'plan_code', v_plan.code));
      update public.freelancer_billing
         set plan_id = v_plan.id, cycle_start = now(),
             cycle_end = now() + make_interval(days => v_plan.cycle_days), proposals_used = 0
       where user_id = pay.payer_id;
    end if;
  elsif v_new in ('rejected','cancelled') and pay.kind = 'subscription' then
    if (select state from public.freelancer_billing where user_id = pay.payer_id) = 'PRO_PENDING_ACTIVATION' then
      perform private.billing_transition(pay.payer_id,
        case when exists (select 1 from public.subscription_events e
                           where e.user_id = pay.payer_id and e.to_state = 'PRO_ACTIVE')
             then 'PRO_EXPIRED' else 'FIRST_PROJECT_COMPLETED' end,
        'payment_' || v_new, jsonb_build_object('payment_id', pay.id));
    end if;
  elsif v_new in ('refunded','charged_back','in_mediation') and pay.contract_id is not null then
    -- sem penalidade automática: registra e encaminha para análise humana
    insert into public.contract_events (contract_id, event, note)
    values (pay.contract_id, 'payment_' || v_new, 'Requer análise da equipe financeira');
  end if;
  return v_new;
end $$;

-- ---------------------------------------------------------------- chat: abrir conversa de projeto
create or replace function public.start_project_conversation(p_project_id uuid, p_freelancer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_project public.projects;
  v_owner uuid;
  v_conv uuid;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Projeto não encontrado' using errcode = 'P0002'; end if;
  select owner_id into v_owner from public.companies where id = v_project.company_id;
  if v_uid not in (v_owner, p_freelancer_id) or v_owner = p_freelancer_id then
    raise exception 'Sem permissão para esta conversa' using errcode = '42501';
  end if;
  -- só existe conversa quando há vínculo real: proposta enviada ou convite da empresa
  if not exists (select 1 from public.proposals where project_id = p_project_id and freelancer_id = p_freelancer_id)
     and not exists (select 1 from public.project_invites where project_id = p_project_id and freelancer_id = p_freelancer_id) then
    raise exception 'É necessário haver proposta ou convite para iniciar a conversa' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_blocks
              where (blocker_id, blocked_id) in ((v_owner, p_freelancer_id), (p_freelancer_id, v_owner))) then
    raise exception 'Conversa indisponível' using errcode = '42501';
  end if;

  select c.id into v_conv from public.conversations c
   where c.project_id = p_project_id
     and exists (select 1 from public.conversation_participants p
                  where p.conversation_id = c.id and p.user_id = p_freelancer_id)
   limit 1;
  if v_conv is null then
    insert into public.conversations (context_type, project_id, created_by)
    values ('project', p_project_id, v_uid) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_owner), (v_conv, p_freelancer_id);
  end if;
  return v_conv;
end $$;
