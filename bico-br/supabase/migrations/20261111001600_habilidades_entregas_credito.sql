-- Bico BR — 0016: habilidades, entrega mapeada dentro do app e crédito do profissional
--
-- DECISÃO DA DIREÇÃO (substitui a D2): a empresa paga o valor total no início; a parte do
-- profissional fica RETIDA e é LIBERADA quando a entrega é validada dentro da plataforma.
--   total pago pela empresa = valor do profissional + taxa de serviço (10% por cima)
--   o profissional recebe 100% do valor que propôs
-- ATENÇÃO JURÍDICA: reter e repassar dinheiro de terceiros é atividade regulada. Antes de operar
-- com dinheiro real é obrigatório (1) parecer jurídico e (2) usar o split do Mercado Pago, em que
-- quem guarda o valor é a instituição de pagamento. Até lá o repasse é registrado e feito pelo financeiro.

update public.platform_settings
   set value = '{"service_fee_on_top": true, "worker_credit": "held_until_delivery_validated", "subscription_auto_renew": false}',
       description = 'Empresa paga valor + taxa; crédito do profissional retido até a entrega ser validada no app.'
 where key = 'payment_model';
insert into public.platform_settings (key, value, description, is_public) values
  ('auto_approve_days', '7', 'Dias sem resposta da empresa após a entrega para a aprovação automática (protege o profissional).', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- habilidades iniciais
insert into public.skills (slug, name) values
  ('power-bi','Power BI'),('excel','Excel'),('google-sheets','Google Sheets'),('sql','SQL'),('python','Python'),
  ('javascript','JavaScript'),('typescript','TypeScript'),('react','React'),('node-js','Node.js'),('php','PHP'),
  ('wordpress','WordPress'),('html-css','HTML e CSS'),('apis','APIs e integrações'),('automacao','Automação'),
  ('inteligencia-artificial','Inteligência artificial'),('banco-de-dados','Banco de dados'),('aplicativos','Aplicativos'),
  ('suporte-tecnico','Suporte técnico'),('analise-de-dados','Análise de dados'),('dashboards','Dashboards'),
  ('design-grafico','Design gráfico'),('identidade-visual','Identidade visual'),('logotipo','Logotipo'),('ui-ux','UI/UX'),
  ('figma','Figma'),('photoshop','Photoshop'),('illustrator','Illustrator'),('canva','Canva'),('apresentacoes','Apresentações'),
  ('ilustracao','Ilustração'),('edicao-de-video','Edição de vídeo'),('reels-e-shorts','Reels e Shorts'),('motion-design','Motion design'),
  ('edicao-de-audio','Edição de áudio'),('locucao','Locução'),('trafego-pago','Tráfego pago'),('seo','SEO'),
  ('copywriting','Copywriting'),('social-media','Social media'),('email-marketing','E-mail marketing'),('prospeccao','Prospecção'),
  ('assistente-virtual','Assistente virtual'),('digitacao','Digitação'),('planilhas','Planilhas'),('controle-financeiro','Controle financeiro'),
  ('contas-a-pagar-e-receber','Contas a pagar e receber'),('recrutamento-e-selecao','Recrutamento e seleção'),
  ('departamento-pessoal','Departamento pessoal'),('folha-de-pagamento','Folha de pagamento'),('redacao','Redação'),
  ('revisao-de-texto','Revisão de texto'),('traducao','Tradução'),('transcricao','Transcrição'),('ingles','Inglês'),('espanhol','Espanhol'),
  ('autocad','AutoCAD'),('bim','BIM'),('desenho-tecnico','Desenho técnico'),('orcamentos','Orçamentos'),
  ('gestao-de-projetos','Gestão de projetos'),('pesquisa-de-mercado','Pesquisa de mercado'),('consultoria-financeira','Consultoria financeira'),
  ('aulas-particulares','Aulas particulares'),('mentoria','Mentoria'),('treinamentos','Treinamentos'),('atendimento-ao-cliente','Atendimento ao cliente')
on conflict (slug) do nothing;
create trigger project_skills_cap before insert on public.project_skills
  for each row execute function private.cap_rows('project_id', '12');
create trigger job_skills_cap before insert on public.job_skills
  for each row execute function private.cap_rows('job_id', '12');

-- ---------------------------------------------------------------- contrato: taxa por cima
alter table public.contracts drop constraint contracts_check;
-- reinterpretação: deposit_cents = taxa de serviço da plataforma; balance_cents = crédito do profissional
alter table public.contracts add constraint contracts_credit_equals_amount check (balance_cents = amount_cents);
comment on column public.contracts.deposit_cents is 'Taxa de serviço da plataforma (cobrada da empresa, por cima do valor do profissional)';
comment on column public.contracts.balance_cents is 'Crédito do profissional = valor da proposta';
alter table public.profile_private add column pix_key text check (char_length(pix_key) between 5 and 140);
grant update (pix_key) on public.profile_private to authenticated;
drop policy profile_private_select on public.profile_private;
create policy profile_private_select on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{support,finance}'));

-- ---------------------------------------------------------------- entregáveis mapeados
create table public.contract_deliverables (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  position integer not null,
  title text not null check (char_length(title) between 2 and 200),
  status text not null default 'pending' check (status in ('pending','delivered','accepted','changes')),
  delivery_note text check (char_length(delivery_note) <= 3000),
  delivery_url text check (delivery_url ~* '^https://[^\s<>"'']+$' and char_length(delivery_url) <= 500),
  delivered_at timestamptz,
  review_note text check (char_length(review_note) <= 2000),
  reviewed_at timestamptz,
  unique (contract_id, position)
);
alter table public.contract_deliverables enable row level security;
grant all on public.contract_deliverables to service_role;
grant select on public.contract_deliverables to authenticated;
create policy contract_deliverables_select on public.contract_deliverables for select to authenticated
  using (private.is_contract_party(contract_id) or private.has_admin_role('{support,finance}'));

-- ---------------------------------------------------------------- crédito do profissional
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts(id) on delete restrict,
  freelancer_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  -- held: retido · blocked: em disputa · released: liberado, aguardando repasse · paid: repassado · refunded: devolvido à empresa
  status text not null default 'held' check (status in ('held','blocked','released','paid','refunded')),
  released_at timestamptz,
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  payment_reference text check (char_length(payment_reference) between 4 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'paid' or (paid_at is not null and payment_reference is not null))
);
create trigger payouts_updated before update on public.payouts for each row execute function private.set_updated_at();
create trigger audit_payouts after insert or update or delete on public.payouts for each row execute function private.audit_row();
create index payouts_status_idx on public.payouts (status, released_at);
create index payouts_freelancer_idx on public.payouts (freelancer_id, created_at desc);
alter table public.payouts enable row level security;
grant all on public.payouts to service_role;
grant select on public.payouts to authenticated;
create policy payouts_select on public.payouts for select to authenticated
  using (freelancer_id = (select auth.uid()) or private.is_contract_party(contract_id) or private.has_admin_role('{finance}'));

-- ---------------------------------------------------------------- aceite: taxa por cima + entregáveis
create or replace function public.accept_proposal(p_proposal_id uuid)
returns public.contracts language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_prop public.proposals;
  v_project public.projects;
  v_rate numeric := coalesce((private.setting('deposit_rate') #>> '{}')::numeric, 0);
  v_terms text := coalesce(private.setting('contract_terms_version') #>> '{}', 'rascunho');
  v_contract public.contracts;
  v_line text; v_pos integer := 0;
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

  update public.proposals set status = 'accepted' where id = p_proposal_id;
  insert into public.contracts (project_id, proposal_id, company_id, company_user_id, freelancer_id,
      scope, deliverables, amount_cents, deposit_rate, deposit_cents, balance_cents, deadline_days, terms_version)
  values (v_project.id, v_prop.id, v_project.company_id, v_uid, v_prop.freelancer_id,
      v_project.description, v_project.deliverables, v_prop.amount_cents, v_rate,
      round(v_prop.amount_cents * v_rate), v_prop.amount_cents, v_prop.deadline_days, v_terms)
  returning * into v_contract;

  -- cada linha dos entregáveis do projeto vira um item a ser entregue e validado
  for v_line in select btrim(regexp_replace(l, '^[-*•\d.)\s]+', '')) from regexp_split_to_table(coalesce(v_project.deliverables, ''), E'\n') l loop
    if char_length(v_line) >= 2 and v_pos < 20 then
      v_pos := v_pos + 1;
      insert into public.contract_deliverables (contract_id, position, title) values (v_contract.id, v_pos, left(v_line, 200));
    end if;
  end loop;
  if v_pos = 0 then
    insert into public.contract_deliverables (contract_id, position, title) values (v_contract.id, 1, 'Entrega do projeto conforme o escopo');
  end if;

  insert into public.contract_events (contract_id, actor_id, event, to_status)
  values (v_contract.id, v_uid, 'proposal_accepted', v_contract.status);
  perform private.notify(v_prop.freelancer_id, 'proposal_accepted',
    jsonb_build_object('contract_id', v_contract.id, 'project_id', v_project.id));
  return v_contract;
end $$;

-- confirmação do profissional: gera UMA cobrança com o total (valor + taxa)
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
  update public.contracts set status = 'awaiting_deposit', freelancer_accepted_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, v_uid, 'freelancer_confirmed', 'awaiting_freelancer', 'awaiting_deposit');
  insert into public.payments (kind, contract_id, payer_id, amount_cents)
  values ('deposit', c.id, c.company_user_id, c.amount_cents + c.deposit_cents);
  perform private.notify(c.company_user_id, 'deposit_due', jsonb_build_object('contract_id', c.id));
  select * into c from public.contracts where id = p_contract_id;
  return c;
end $$;

-- pagamento confirmado: contrato inicia e o crédito do profissional nasce RETIDO
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
  insert into public.payouts (contract_id, freelancer_id, amount_cents) values (c.id, c.freelancer_id, c.balance_cents)
  on conflict (contract_id) do nothing;
  if v_state = 'FREE_UNLIMITED' then
    perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_ACTIVE', 'first_contract_started',
      jsonb_build_object('contract_id', c.id));
  end if;
  update public.projects p set status = 'in_progress'
   where p.id = c.project_id and p.status = 'open'
     and (select count(*) from public.contracts k
           where k.project_id = p.id and k.status in ('active','delivered','completed')) >= p.professionals_wanted;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status)
  values (c.id, p_actor, 'contract_started', 'awaiting_deposit', 'active');
  perform private.notify(c.freelancer_id, 'contract_started', jsonb_build_object('contract_id', c.id));
  perform private.notify(c.company_user_id, 'contract_started', jsonb_build_object('contract_id', c.id));
end $$;

-- ---------------------------------------------------------------- entrega dentro do app
-- p_items: [{"id": <item>, "note": "...", "url": "https://..."}]. Nulo = entrega todos os itens com a nota geral.
drop function public.deliver_contract(uuid, text, jsonb);
create function public.deliver_contract(p_contract_id uuid, p_note text, p_items jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts; v_item jsonb; v_missing integer;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.freelancer_id is distinct from v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'active' then
    raise exception 'Contrato não está em execução' using errcode = 'P0001';
  end if;
  if char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'Descreva a entrega com pelo menos 10 caracteres' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    update public.contract_deliverables set status = 'delivered', delivery_note = left(p_note, 3000), delivered_at = now()
     where contract_id = c.id and status in ('pending','changes');
  else
    if jsonb_array_length(p_items) > 20 then raise exception 'Itens demais' using errcode = 'P0001'; end if;
    for v_item in select * from jsonb_array_elements(p_items) loop
      update public.contract_deliverables
         set status = 'delivered', delivered_at = now(),
             delivery_note = left(nullif(btrim(v_item ->> 'note'), ''), 3000),
             delivery_url = nullif(btrim(v_item ->> 'url'), '')
       where contract_id = c.id and id = (v_item ->> 'id')::bigint and status in ('pending','changes');
    end loop;
  end if;
  select count(*) into v_missing from public.contract_deliverables where contract_id = c.id and status in ('pending','changes');
  if v_missing > 0 then
    raise exception 'Faltam % item(ns) do contrato na entrega. Todos precisam ser entregues dentro da plataforma.', v_missing
      using errcode = 'P0001', detail = 'ITEMS_MISSING';
  end if;
  update public.contracts set status = 'delivered', delivered_at = now() where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, v_uid, 'delivered', 'active', 'delivered', p_note);
  perform private.notify(c.company_user_id, 'contract_delivered', jsonb_build_object('contract_id', c.id));
end $$;

drop function public.request_changes(uuid, text);
create function public.request_changes(p_contract_id uuid, p_note text, p_item_ids bigint[] default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.company_user_id is distinct from v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'delivered' then
    raise exception 'Não há entrega pendente de análise' using errcode = 'P0001';
  end if;
  if char_length(coalesce(btrim(p_note), '')) < 10 then
    raise exception 'Explique o ajuste com pelo menos 10 caracteres' using errcode = 'P0001';
  end if;
  update public.contract_deliverables
     set status = case when p_item_ids is null or id = any (p_item_ids) then 'changes' else 'accepted' end,
         review_note = case when p_item_ids is null or id = any (p_item_ids) then left(p_note, 2000) else review_note end,
         reviewed_at = now()
   where contract_id = c.id and status = 'delivered';
  update public.contracts set status = 'active' where id = c.id;
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, v_uid, 'changes_requested', 'delivered', 'active', p_note);
  perform private.notify(c.freelancer_id, 'changes_requested', jsonb_build_object('contract_id', c.id));
end $$;

-- conclusão: valida os itens e LIBERA o crédito do profissional
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
    perform private.billing_transition(c.freelancer_id, 'FIRST_PROJECT_COMPLETED', 'first_contract_completed',
      jsonb_build_object('contract_id', c.id));
    perform private.notify(c.freelancer_id, 'pro_offer', jsonb_build_object('contract_id', c.id));
  end if;
  update public.projects p set status = 'completed'
   where p.id = c.project_id and p.status = 'in_progress'
     and not exists (select 1 from public.contracts k where k.project_id = p.id
                      and k.status in ('awaiting_freelancer','awaiting_deposit','active','delivered','disputed'));
  update public.referrals set status = 'qualified', qualified_contract_id = c.id
   where status = 'pending' and referred_id in (c.freelancer_id, c.company_user_id);
  perform private.notify(c.freelancer_id, 'credit_released', jsonb_build_object('contract_id', c.id, 'amount_cents', c.balance_cents));
end $$;
revoke all on function private.complete_contract(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.approve_delivery(p_contract_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or c.company_user_id is distinct from v_uid then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status <> 'delivered' then
    raise exception 'Não há entrega pendente de aprovação' using errcode = 'P0001';
  end if;
  perform private.complete_contract(c.id, v_uid, 'approved');
end $$;

-- empresa sumiu depois da entrega: aprovação automática após o prazo (executada pelo agendador)
create or replace function public.auto_approve_deliveries()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_days integer := coalesce((private.setting('auto_approve_days') #>> '{}')::integer, 7);
begin
  for r in select id from public.contracts
            where status = 'delivered' and delivered_at < now() - make_interval(days => v_days) loop
    perform private.complete_contract(r.id, null, 'auto_approved');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.auto_approve_deliveries() from public, anon, authenticated;
grant execute on function public.auto_approve_deliveries() to service_role;

-- ---------------------------------------------------------------- reclamação: congela o crédito ainda não repassado
create or replace function public.open_dispute(p_contract_id uuid, p_reason text, p_description text)
returns public.disputes language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); c public.contracts; d public.disputes; v_other uuid;
begin
  select * into c from public.contracts where id = p_contract_id for update;
  if not found or v_uid is null or v_uid not in (c.freelancer_id, c.company_user_id) then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;
  if c.status not in ('active','delivered','completed') then
    raise exception 'Este contrato não permite abertura de reclamação no estado atual' using errcode = 'P0001';
  end if;
  if c.status = 'completed' and c.completed_at < now() - interval '30 days' then
    raise exception 'O prazo de 30 dias após a conclusão para reclamar já terminou. Fale com o suporte.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.disputes where contract_id = c.id and status not in ('resolved','closed')) then
    raise exception 'Já existe uma disputa em andamento para este contrato' using errcode = 'P0001';
  end if;
  insert into public.disputes (contract_id, opened_by, reason, description, previous_contract_status)
  values (c.id, v_uid, p_reason, p_description, c.status) returning * into d;
  if c.status <> 'completed' then
    update public.contracts set status = 'disputed' where id = c.id;
  end if;
  -- o que ainda não foi repassado fica congelado até a decisão
  update public.payouts set status = 'blocked' where contract_id = c.id and status in ('held','released');
  insert into public.contract_events (contract_id, actor_id, event, from_status, to_status, note)
  values (c.id, v_uid, 'dispute_opened', c.status,
          case when c.status = 'completed' then 'completed' else 'disputed' end, d.protocol);
  v_other := case when v_uid = c.freelancer_id then c.company_user_id else c.freelancer_id end;
  perform private.notify(v_other, 'dispute_opened', jsonb_build_object('contract_id', c.id, 'protocol', d.protocol));
  return d;
end $$;

-- decisão: 'resume' retoma · 'complete' libera o crédito ao profissional · 'cancel' devolve à empresa
create or replace function public.resolve_dispute(p_dispute_id uuid, p_resolution text, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); d public.disputes; c public.contracts; v_pay public.payments; v_po public.payouts;
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
  select * into v_po from public.payouts where contract_id = c.id for update;
  update public.disputes set status = 'resolved', resolution = p_resolution, resolved_by = v_uid, resolved_at = now() where id = d.id;

  if p_outcome = 'complete' then
    if c.status = 'completed' then
      update public.payouts set status = 'released', released_at = coalesce(released_at, now()) where contract_id = c.id and status = 'blocked';
    else
      perform private.complete_contract(c.id, null, 'completed_by_dispute');
    end if;
  elsif p_outcome = 'resume' then
    if c.status = 'disputed' then
      update public.contracts set status = coalesce(d.previous_contract_status, 'active') where id = c.id;
      update public.payouts set status = 'held' where contract_id = c.id and status = 'blocked';
    else
      update public.payouts set status = 'released', released_at = coalesce(released_at, now()) where contract_id = c.id and status = 'blocked';
    end if;
  else -- cancel: devolução à empresa, se o crédito ainda não foi repassado
    if v_po.status = 'paid' then
      raise exception 'O crédito já foi repassado ao profissional; a devolução precisa ser tratada fora do fluxo automático' using errcode = 'P0001';
    end if;
    update public.contracts set status = 'cancelled', cancelled_at = now(),
           cancel_reason = 'Encerrado por decisão da disputa ' || d.protocol where id = c.id;
    update public.payouts set status = 'refunded' where contract_id = c.id;
    select * into v_pay from public.payments where contract_id = c.id and kind = 'deposit' and status = 'approved' limit 1;
    if found then
      insert into public.refunds (payment_id, amount_cents, reason, origin)
      values (v_pay.id, v_pay.amount_cents, 'Devolução por decisão da disputa ' || d.protocol, 'system');
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

-- financeiro registra o repasse feito ao profissional
create or replace function public.mark_payout_paid(p_payout_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); po public.payouts;
begin
  if not private.has_admin_role('{finance}') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select * into po from public.payouts where id = p_payout_id for update;
  if not found or po.status <> 'released' then
    raise exception 'Só é possível registrar repasse de crédito liberado' using errcode = 'P0001';
  end if;
  if char_length(coalesce(btrim(p_reference), '')) < 4 then
    raise exception 'Informe o comprovante/identificador da transferência' using errcode = 'P0001';
  end if;
  update public.payouts set status = 'paid', paid_at = now(), paid_by = v_uid, payment_reference = btrim(p_reference) where id = po.id;
  perform private.notify(po.freelancer_id, 'payout_paid', jsonb_build_object('contract_id', po.contract_id, 'amount_cents', po.amount_cents));
end $$;

drop function if exists public.declare_balance_paid(uuid);
drop function if exists public.confirm_balance_received(uuid);

-- indicadores: receita = taxa de serviço dos contratos pagos (não o total que passou pela plataforma)
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
    'gmv_centavos', (select coalesce(sum(amount_cents), 0) from public.contracts where started_at >= v_since),
    'ticket_medio_centavos', (select coalesce(round(avg(amount_cents)), 0) from public.contracts where started_at >= v_since),
    'receita_taxa_servico_centavos', (select coalesce(sum(c.deposit_cents), 0) from public.payments p join public.contracts c on c.id = p.contract_id
                                       where p.kind = 'deposit' and p.status = 'approved' and p.paid_at >= v_since and c.status <> 'cancelled'),
    'receita_assinaturas_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where kind = 'subscription' and status = 'approved' and paid_at >= v_since),
    'receita_anuncios_centavos', (select coalesce(sum(price_cents), 0) from public.ad_campaigns where status in ('active','ended') and starts_at >= v_since),
    'estornos_centavos', (select coalesce(sum(amount_cents), 0) from public.payments where status in ('refunded','charged_back') and updated_at >= v_since),
    -- dinheiro de terceiros sob guarda: NÃO é receita
    'creditos_retidos_centavos', (select coalesce(sum(amount_cents), 0) from public.payouts where status in ('held','blocked')),
    'repasses_pendentes_centavos', (select coalesce(sum(amount_cents), 0) from public.payouts where status = 'released'),
    'assinantes_ativos', (select count(*) from public.freelancer_billing where state = 'PRO_ACTIVE' and cycle_end > now()),
    'disputas_abertas', (select count(*) from public.disputes where status not in ('resolved','closed')),
    'disputas_no_periodo', (select count(*) from public.disputes where created_at >= v_since),
    'reembolsos_pendentes', (select count(*) from public.refunds where status = 'requested'),
    'denuncias_abertas', (select count(*) from public.reports where status in ('open','in_review'))
  );
end $$;

revoke all on function public.deliver_contract(uuid, text, jsonb), public.request_changes(uuid, text, bigint[]),
  public.approve_delivery(uuid), public.open_dispute(uuid, text, text), public.resolve_dispute(uuid, text, text),
  public.mark_payout_paid(uuid, text), public.accept_proposal(uuid), public.confirm_contract(uuid), public.admin_metrics(integer) from public, anon;
grant execute on function public.deliver_contract(uuid, text, jsonb), public.request_changes(uuid, text, bigint[]),
  public.approve_delivery(uuid), public.open_dispute(uuid, text, text), public.resolve_dispute(uuid, text, text),
  public.mark_payout_paid(uuid, text), public.accept_proposal(uuid), public.confirm_contract(uuid), public.admin_metrics(integer)
  to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('bico-aprovacao-automatica', '17 * * * *', 'select public.auto_approve_deliveries()');
  end if;
end $$;
