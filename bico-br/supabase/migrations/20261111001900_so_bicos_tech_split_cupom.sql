-- Bico BR — 0019: só bicos de tecnologia, pagamento direto pelo Mercado Pago (split), cupom e controle de assinaturas
--
-- DECISÕES DA DIREÇÃO:
--  * A plataforma NÃO guarda dinheiro de terceiros. A empresa paga pelo Mercado Pago (cartão, Pix etc.);
--    o Mercado Pago envia a parte do profissional para a conta Mercado Pago dele e a taxa de 10% para o Bico BR.
--    Consequências: o profissional precisa conectar a conta Mercado Pago; o valor chega a ele no pagamento
--    (prazo de liberação conforme o Mercado Pago), e a tarifa do Mercado Pago é descontada dele.
--  * Sem vagas de emprego (CLT etc.): só bicos/projetos remotos de tecnologia.
--  * Cupom de lançamento: 15 dias de assinatura grátis para o profissional.

-- ---------------------------------------------------------------- sem vagas de emprego
update public.jobs set status = 'closed' where status in ('open', 'paused', 'draft');
revoke insert, update on public.jobs from authenticated;
revoke insert, update on public.job_applications from authenticated;
revoke insert, delete on public.job_skills from authenticated;

-- ---------------------------------------------------------------- foco em tecnologia
update public.categories set is_active = slug in ('tecnologia-e-programacao', 'dados-e-inteligencia-empresarial');
update public.skills set is_active = false where slug in (
  'design-grafico','identidade-visual','logotipo','photoshop','illustrator','canva','apresentacoes','ilustracao','edicao-de-video',
  'reels-e-shorts','motion-design','edicao-de-audio','locucao','trafego-pago','copywriting','social-media','email-marketing','prospeccao',
  'assistente-virtual','digitacao','controle-financeiro','contas-a-pagar-e-receber','recrutamento-e-selecao','departamento-pessoal',
  'folha-de-pagamento','redacao','revisao-de-texto','traducao','transcricao','ingles','espanhol','autocad','bim','desenho-tecnico',
  'orcamentos','pesquisa-de-mercado','consultoria-financeira','aulas-particulares','mentoria','treinamentos','atendimento-ao-cliente');
insert into public.skills (slug, name) values
  ('java','Java'),('c-sharp','C# e .NET'),('go','Go'),('ruby','Ruby on Rails'),('laravel','Laravel'),('django','Django'),
  ('vue','Vue.js'),('angular','Angular'),('next-js','Next.js'),('flutter','Flutter'),('react-native','React Native'),
  ('android','Android (Kotlin)'),('ios','iOS (Swift)'),('postgresql','PostgreSQL'),('mysql','MySQL'),('mongodb','MongoDB'),
  ('supabase','Supabase'),('firebase','Firebase'),('aws','AWS'),('docker','Docker'),('devops','DevOps e CI/CD'),('linux','Linux'),
  ('testes-qa','Testes e QA'),('seguranca','Segurança da informação'),('web-scraping','Web scraping'),('chatbots','Chatbots'),
  ('n8n-zapier','n8n e Zapier'),('e-commerce','E-commerce'),('shopify','Shopify'),('git','Git'),('engenharia-de-dados','Engenharia de dados'),
  ('machine-learning','Machine learning'),('landing-pages','Landing pages'),('tailwind','Tailwind CSS')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- conta Mercado Pago do profissional
-- Tokens ficam CIFRADOS pelo backend (AES-256-GCM) e nesta tabela sem nenhum acesso pelos papéis de API.
create table public.mp_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mp_user_id text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mp_accounts enable row level security;
grant all on public.mp_accounts to service_role;
create trigger mp_accounts_updated before update on public.mp_accounts for each row execute function private.set_updated_at();
-- indicador público (não editável pelo usuário): o profissional pode receber?
alter table public.freelancer_profiles add column mp_connected boolean not null default false;

create or replace function public.confirm_contract(p_contract_id uuid)
returns public.contracts language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.freelancer_id is distinct from v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'awaiting_freelancer' then
    raise exception 'Contrato não está aguardando confirmação' using errcode = 'P0001';
  end if;
  if not (select mp_connected from public.freelancer_profiles where user_id = v_uid) then
    raise exception 'Conecte sua conta do Mercado Pago em Meu perfil para receber por este projeto.'
      using errcode = 'P0001', detail = 'MP_NOT_CONNECTED';
  end if;
  update public.contracts set status = 'awaiting_deposit', freelancer_accepted_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, v_uid, 'freelancer_confirmed', 'awaiting_freelancer', 'awaiting_deposit');
  insert into public.payments (kind, contract_id, payer_id, amount_cents)
  values ('deposit', c.id, c.company_user_id, c.amount_cents + c.deposit_cents);
  perform private.notify(c.company_user_id, 'deposit_due', jsonb_build_object('contract_id', c.id));
  select * into c from public.contracts where id = p_contract_id;
  return c;
end $$;

-- pagamento confirmado: o Mercado Pago já destinou a parte do profissional à conta dele
create or replace function private.activate_contract(p_contract_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.contracts; v_state text;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if c.status <> 'awaiting_deposit' then return; end if;
  select state into v_state from public.freelancer_billing where user_id = c.freelancer_id for update;
  update public.contracts
     set status = 'active', started_at = now(), due_at = now() + make_interval(days => c.deadline_days),
         is_first_bico = (v_state = 'FREE_UNLIMITED')
   where id = c.id;
  insert into public.payouts (contract_id, freelancer_id, amount_cents, status, released_at, paid_at, payment_reference)
  values (c.id, c.freelancer_id, c.balance_cents, 'paid', now(), now(), 'Mercado Pago (split)')
  on conflict (contract_id) do nothing;
  if v_state = 'FREE_UNLIMITED' then
    perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_ACTIVE', 'first_contract_started', jsonb_build_object('contract_id', c.id));
  end if;
  update public.projects p set status = 'in_progress'
   where p.id = c.project_id and p.status = 'open'
     and (select count(*) from public.contracts k where k.project_id = p.id and k.status in ('active','delivered','completed')) >= p.professionals_wanted;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, p_actor, 'contract_started', 'awaiting_deposit', 'active');
  perform private.notify(c.freelancer_id, 'contract_started', jsonb_build_object('contract_id', c.id));
  perform private.notify(c.company_user_id, 'contract_started', jsonb_build_object('contract_id', c.id));
end $$;

-- ---------------------------------------------------------------- cupons
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,24}$'),
  description text check (char_length(description) <= 200),
  trial_days integer not null check (trial_days between 1 and 90),
  max_redemptions integer check (max_redemptions > 0),
  redeemed_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.coupon_redemptions (
  user_id uuid primary key references public.profiles(id) on delete cascade, -- um cupom por profissional
  coupon_id uuid not null references public.coupons(id),
  redeemed_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
grant all on public.coupons, public.coupon_redemptions to service_role;
grant select, insert, update on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
create policy coupons_admin_select on public.coupons for select to authenticated using (private.has_admin_role('{finance}'));
create policy coupons_admin_insert on public.coupons for insert to authenticated with check (private.has_admin_role('{finance}'));
create policy coupons_admin_update on public.coupons for update to authenticated using (private.has_admin_role('{finance}')) with check (private.has_admin_role('{finance}'));
create policy coupon_redemptions_select on public.coupon_redemptions for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{finance}'));
create trigger audit_coupons after insert or delete or update of code, trial_days, max_redemptions, expires_at, is_active
  on public.coupons for each row execute function private.audit_row();

alter table public.freelancer_billing add column trial_days_pending integer not null default 0 check (trial_days_pending between 0 and 90);

-- usa os dias de cupom assim que a assinatura passa a ser necessária
create or replace function private.apply_pending_trial(p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare b public.freelancer_billing; v_plan uuid;
begin
  select * into b from public.freelancer_billing where user_id = p_user for update;
  if not found or b.trial_days_pending = 0 or b.state not in ('FIRST_PROJECT_COMPLETED', 'PRO_EXPIRED') then return false; end if;
  select id into v_plan from public.plans where code = 'pro';
  perform private.billing_transition(p_user, case when b.state = 'FIRST_PROJECT_COMPLETED' then 'PRO_ACTIVE' else 'PRO_ACTIVE' end,
    'coupon_trial', jsonb_build_object('days', b.trial_days_pending));
  update public.freelancer_billing
     set plan_id = v_plan, cycle_start = now(), cycle_end = now() + make_interval(days => b.trial_days_pending),
         proposals_used = 0, trial_days_pending = 0
   where user_id = p_user;
  perform private.notify(p_user, 'trial_started', jsonb_build_object('days', b.trial_days_pending));
  return true;
end $$;
revoke all on function private.apply_pending_trial(uuid) from public, anon, authenticated;

create or replace function public.redeem_coupon(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); cp public.coupons; v_applied boolean;
begin
  if not exists (select 1 from public.freelancer_billing where user_id = v_uid) then
    raise exception 'Cupons são para contas de profissional' using errcode = '42501';
  end if;
  perform private.assert_not_suspended(v_uid);
  if exists (select 1 from public.coupon_redemptions where user_id = v_uid) then
    raise exception 'Você já usou um cupom' using errcode = 'P0001', detail = 'COUPON_ALREADY_USED';
  end if;
  select * into cp from public.coupons where code = upper(btrim(coalesce(p_code, ''))) for update;
  -- mesma mensagem para inexistente, vencido ou esgotado: não ajuda quem tenta adivinhar códigos
  if not found or not cp.is_active or (cp.expires_at is not null and cp.expires_at <= now())
     or (cp.max_redemptions is not null and cp.redeemed_count >= cp.max_redemptions) then
    raise exception 'Cupom inválido ou indisponível' using errcode = 'P0001', detail = 'COUPON_INVALID';
  end if;
  insert into public.coupon_redemptions (user_id, coupon_id) values (v_uid, cp.id);
  update public.coupons set redeemed_count = redeemed_count + 1 where id = cp.id;
  update public.freelancer_billing set trial_days_pending = cp.trial_days where user_id = v_uid;
  v_applied := private.apply_pending_trial(v_uid);
  return jsonb_build_object('days', cp.trial_days, 'applied_now', v_applied);
end $$;
revoke all on function public.redeem_coupon(text) from public, anon;
grant execute on function public.redeem_coupon(text) to authenticated, service_role;
create trigger coupon_attempts_cap before insert on public.coupon_redemptions for each row execute function private.cap_rows('user_id', '1');

insert into public.coupons (code, description, trial_days, max_redemptions, expires_at)
values ('LANCAMENTO15', 'Lançamento: 15 dias de assinatura grátis para profissionais', 15, 5000, now() + interval '120 days')
on conflict (code) do nothing;

-- conclusão do contrato: cupom entra em ação quando o primeiro projeto termina
create or replace function private.complete_contract(p_contract_id uuid, p_actor uuid, p_event text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.contracts; v_state text;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  update public.contracts set status = 'completed', completed_at = now() where id = c.id;
  update public.contract_deliverables set status = 'accepted', reviewed_at = now() where contract_id = c.id and status <> 'accepted';
  update public.payouts set status = 'released', released_at = now() where contract_id = c.id and status in ('held','blocked');
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, p_actor, p_event, c.status, 'completed');
  update public.freelancer_profiles set completed_projects = completed_projects + 1 where user_id = c.freelancer_id;
  select state into v_state from public.freelancer_billing where user_id = c.freelancer_id for update;
  if v_state = 'FIRST_PROJECT_ACTIVE' then
    perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_COMPLETED', 'first_contract_completed', jsonb_build_object('contract_id', c.id));
    if not private.apply_pending_trial(c.freelancer_id) then
      perform private.notify(c.freelancer_id, 'pro_offer', jsonb_build_object('contract_id', c.id));
    end if;
  end if;
  update public.projects p set status = 'completed'
   where p.id = c.project_id and p.status = 'in_progress'
     and not exists (select 1 from public.contracts k where k.project_id = p.id
                      and k.status in ('awaiting_freelancer','awaiting_deposit','active','delivered','disputed'));
  update public.referrals set status = 'qualified', qualified_contract_id = c.id
   where status = 'pending' and referred_id in (c.freelancer_id, c.company_user_id);
  perform private.notify(c.freelancer_id, 'contract_completed', jsonb_build_object('contract_id', c.id));
end $$;
revoke all on function private.complete_contract(uuid, uuid, text) from public, anon, authenticated;

-- reclamação com decisão de cancelar: como o valor já foi ao profissional, gera pedido de devolução a executar no Mercado Pago
create or replace function public.resolve_dispute(p_dispute_id uuid, p_resolution text, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); d public.disputes; c public.contracts; v_pay public.payments;
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
  update public.disputes set status = 'resolved', resolution = p_resolution, resolved_by = v_uid, resolved_at = now() where id = d.id;

  if p_outcome = 'complete' then
    if c.status <> 'completed' then perform private.complete_contract(c.id, null, 'completed_by_dispute'); end if;
  elsif p_outcome = 'resume' then
    if c.status = 'disputed' then
      update public.contracts set status = coalesce(d.previous_contract_status, 'active') where id = c.id;
    end if;
  else
    update public.contracts set status = 'cancelled', cancelled_at = now(),
           cancel_reason = 'Encerrado por decisão da disputa ' || d.protocol where id = c.id;
    select * into v_pay from public.payments where contract_id = c.id and kind = 'deposit' and status = 'approved' limit 1;
    if found then
      insert into public.refunds (payment_id, amount_cents, reason, origin)
      values (v_pay.id, v_pay.amount_cents, 'Devolução por decisão da disputa ' || d.protocol || ' — executar no Mercado Pago', 'system');
    end if;
    if c.status = 'completed' then
      update public.freelancer_profiles set completed_projects = greatest(completed_projects - 1, 0) where user_id = c.freelancer_id;
    elsif c.is_first_bico
       and (select state from public.freelancer_billing where user_id = c.freelancer_id) = 'FIRST_PROJECT_ACTIVE'
       and not exists (select 1 from public.contracts k where k.freelancer_id = c.freelancer_id
                        and k.id <> c.id and k.status in ('active','delivered','disputed')) then
      perform private.billing_transition(c.freelancer_id, 'FREE_UNLIMITED', 'first_contract_cancelled', jsonb_build_object('contract_id', c.id));
    end if;
  end if;
  insert into public.contract_events (contract_id, actor_id, event, note)
  values (c.id, null, 'dispute_resolved', d.protocol || ': ' || p_resolution);
  perform private.notify(c.freelancer_id, 'dispute_resolved', jsonb_build_object('contract_id', c.id, 'protocol', d.protocol));
  perform private.notify(c.company_user_id, 'dispute_resolved', jsonb_build_object('contract_id', c.id, 'protocol', d.protocol));
end $$;

-- ---------------------------------------------------------------- assinaturas: renovação antecipada e avisos de vencimento
create or replace function public.request_pro(p_plan_code text, p_accept boolean)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_plan public.plans; v_bill public.freelancer_billing; v_pay public.payments;
begin
  if p_accept is not true then
    raise exception 'É necessário aceitar expressamente o preço e as condições do plano' using errcode = 'P0001', detail = 'CONSENT_REQUIRED';
  end if;
  select * into v_bill from public.freelancer_billing where user_id = v_uid for update;
  if not found then raise exception 'Apenas profissionais podem assinar' using errcode = '42501'; end if;
  if v_bill.state in ('PRO_ACTIVE','PRO_CANCELLED') and v_bill.cycle_end <= now() then
    perform private.billing_transition(v_uid, 'PRO_EXPIRED', 'cycle_ended');
    v_bill.state := 'PRO_EXPIRED';
  end if;
  -- cobrança pendente existente é reaproveitada (nunca gera cobrança em dobro)
  select * into v_pay from public.payments
   where payer_id = v_uid and kind = 'subscription' and status in ('pending','in_process') order by created_at desc limit 1;
  if found and v_bill.state in ('PRO_PENDING_ACTIVATION','PRO_ACTIVE','PRO_CANCELLED') then return v_pay; end if;

  select * into v_plan from public.plans where code = p_plan_code and audience = 'freelancer' and is_active and price_cents is not null;
  if not found then raise exception 'Plano indisponível' using errcode = 'P0002'; end if;

  if v_bill.state in ('PRO_ACTIVE','PRO_CANCELLED') then
    -- renovação antecipada: permitida nos últimos 7 dias; o novo período começa quando o atual termina
    if v_bill.cycle_end > now() + interval '7 days' then
      raise exception 'Sua assinatura ainda está válida. A renovação fica disponível 7 dias antes do vencimento.'
        using errcode = 'P0001', detail = 'STATE_NOT_ELIGIBLE';
    end if;
  elsif v_bill.state not in ('FIRST_PROJECT_COMPLETED','PRO_EXPIRED') then
    raise exception 'A assinatura não está disponível no estado atual (%)', v_bill.state using errcode = 'P0001', detail = 'STATE_NOT_ELIGIBLE';
  end if;

  update public.freelancer_billing
     set consent_at = now(),
         consent_snapshot = jsonb_build_object('plan_code', v_plan.code, 'plan_name', v_plan.name, 'price_cents', v_plan.price_cents,
           'proposals_per_cycle', v_plan.proposals_per_cycle, 'cycle_days', v_plan.cycle_days, 'auto_renew', false)
   where user_id = v_uid;
  if v_bill.state in ('FIRST_PROJECT_COMPLETED','PRO_EXPIRED') then
    update public.freelancer_billing set plan_id = v_plan.id where user_id = v_uid;
    perform private.billing_transition(v_uid, 'PRO_PENDING_ACTIVATION', 'consent_given',
      jsonb_build_object('plan_code', v_plan.code, 'price_cents', v_plan.price_cents));
  end if;
  insert into public.payments (kind, plan_id, payer_id, amount_cents)
  values ('subscription', v_plan.id, v_uid, v_plan.price_cents) returning * into v_pay;
  return v_pay;
end $$;

create or replace function public.process_payment_update(
  p_payment_id uuid, p_provider_payment_id text, p_provider_status text, p_status_detail text, p_amount_cents bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments; v_new text; v_plan public.plans; v_bill public.freelancer_billing; v_contract_status text; v_result text;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then return 'payment_not_found'; end if;
  v_new := case p_provider_status
    when 'approved' then 'approved' when 'authorized' then 'in_process' when 'in_process' then 'in_process'
    when 'pending' then 'pending' when 'rejected' then 'rejected' when 'cancelled' then 'cancelled'
    when 'refunded' then 'refunded' when 'charged_back' then 'charged_back' when 'in_mediation' then 'in_mediation' else null end;
  if v_new is null then return 'unknown_status'; end if;
  if pay.provider_payment_id is not null and pay.provider_payment_id <> p_provider_payment_id
     and pay.status in ('approved','refunded','charged_back','in_mediation') then
    return 'provider_id_conflict';
  end if;
  if v_new = 'approved' and p_amount_cents is distinct from pay.amount_cents then
    update public.payments set provider_payment_id = p_provider_payment_id, provider_status = p_provider_status,
           provider_status_detail = 'amount_mismatch' where id = pay.id;
    return 'amount_mismatch';
  end if;
  if pay.status in ('approved','refunded','charged_back','in_mediation') and v_new in ('pending','in_process','rejected','cancelled') then
    return 'ignored_regression';
  end if;
  if pay.status = 'cancelled' and v_new in ('pending','in_process') then return 'ignored_cancelled'; end if;

  update public.payments
     set status = v_new, provider_payment_id = p_provider_payment_id, provider_status = p_provider_status,
         provider_status_detail = p_status_detail,
         paid_at = case when v_new = 'approved' then coalesce(paid_at, now()) else paid_at end
   where id = pay.id;
  v_result := v_new;

  if v_new = 'approved' and pay.status <> 'approved' then
    if pay.kind = 'deposit' then
      select status into v_contract_status from public.contracts where id = pay.contract_id for update;
      if v_contract_status = 'awaiting_deposit' then
        perform private.activate_contract(pay.contract_id, null);
      else
        insert into public.refunds (payment_id, amount_cents, reason, origin)
        values (pay.id, pay.amount_cents, 'Pagamento confirmado para contrato em estado "' || v_contract_status || '". Devolução para análise.', 'system');
        insert into public.contract_events (contract_id, event, note)
        values (pay.contract_id, 'payment_needs_refund', 'Pagamento recebido fora do fluxo; reembolso aberto para o financeiro');
        v_result := 'approved_needs_refund';
      end if;
    elsif pay.kind = 'subscription' then
      select * into v_plan from public.plans where id = pay.plan_id;
      select * into v_bill from public.freelancer_billing where user_id = pay.payer_id for update;
      if v_bill.state in ('PRO_ACTIVE','PRO_CANCELLED') and v_bill.cycle_end > now() then
        -- renovação antecipada: soma um período ao fim do período vigente (nenhum dia pago é perdido)
        perform private.billing_transition(pay.payer_id, 'PRO_ACTIVE', 'renewal', jsonb_build_object('payment_id', pay.id));
        update public.freelancer_billing
           set plan_id = v_plan.id, cycle_end = cycle_end + make_interval(days => v_plan.cycle_days) where user_id = pay.payer_id;
      elsif v_bill.state in ('FIRST_PROJECT_COMPLETED','PRO_PENDING_ACTIVATION','PRO_EXPIRED','PRO_CANCELLED','PRO_ACTIVE') then
        perform private.billing_transition(pay.payer_id, 'PRO_ACTIVE', 'payment_approved', jsonb_build_object('payment_id', pay.id, 'plan_code', v_plan.code));
        update public.freelancer_billing
           set plan_id = v_plan.id, cycle_start = now(), cycle_end = now() + make_interval(days => v_plan.cycle_days), proposals_used = 0
         where user_id = pay.payer_id;
      else
        insert into public.refunds (payment_id, amount_cents, reason, origin)
        values (pay.id, pay.amount_cents, 'Pagamento de assinatura com conta no estado "' || v_bill.state || '". Devolução para análise.', 'system');
        v_result := 'approved_needs_refund';
      end if;
    end if;
  elsif v_new in ('rejected','cancelled') and pay.kind = 'subscription' then
    if (select state from public.freelancer_billing where user_id = pay.payer_id) = 'PRO_PENDING_ACTIVATION'
       and not exists (select 1 from public.payments o where o.payer_id = pay.payer_id and o.kind = 'subscription'
                        and o.id <> pay.id and o.status in ('pending','in_process')) then
      perform private.billing_transition(pay.payer_id,
        case when exists (select 1 from public.subscription_events e where e.user_id = pay.payer_id and e.to_state = 'PRO_ACTIVE')
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

-- aviso de vencimento (3 dias antes), uma vez por período
create or replace function public.notify_expiring_subscriptions()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select b.user_id, b.cycle_end from public.freelancer_billing b
            where b.state = 'PRO_ACTIVE' and b.cycle_end > now() and b.cycle_end <= now() + interval '3 days'
              and not exists (select 1 from public.notifications x where x.user_id = b.user_id and x.type = 'subscription_expiring'
                               and (x.payload ->> 'cycle_end')::timestamptz = b.cycle_end) loop
    insert into public.notifications (user_id, type, payload) values (r.user_id, 'subscription_expiring', jsonb_build_object('cycle_end', r.cycle_end));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_expiring_subscriptions() from public, anon, authenticated;
grant execute on function public.notify_expiring_subscriptions() to service_role;
revoke all on function public.request_pro(text, boolean), public.confirm_contract(uuid), public.resolve_dispute(uuid, text, text) from public, anon;
grant execute on function public.request_pro(text, boolean), public.confirm_contract(uuid), public.resolve_dispute(uuid, text, text) to authenticated, service_role;

update public.platform_settings
   set value = '{"service_fee_on_top": true, "money_flow": "mercado_pago_split", "platform_holds_funds": false, "subscription_auto_renew": false}',
       description = 'Empresa paga pelo Mercado Pago; o Mercado Pago destina a parte do profissional à conta dele e a taxa ao Bico BR. A plataforma não guarda valores.'
 where key = 'payment_model';
update public.plans set features = '["Propostas ilimitadas", "Projetos ilimitados no período", "Sem comissão do Bico BR sobre o que você recebe"]' where code = 'pro';

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('bico-aviso-vencimento', '41 12 * * *', 'select public.notify_expiring_subscriptions()');
  end if;
end $$;
