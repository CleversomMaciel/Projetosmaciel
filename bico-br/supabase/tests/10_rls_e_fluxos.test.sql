-- Testes de RLS e dos fluxos de negócio. Qualquer falha aborta (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
create schema t;
grant usage on schema t to public;
create table t.ids (name text primary key, id uuid not null);
grant select on t.ids to public;

create function t.id(p text) returns uuid language sql stable as $$ select id from t.ids where name = p $$;
create function t.login(p text, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', t.id(p)::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', t.id(p), 'aal', p_aal)::text, false);
  perform set_config('role', 'authenticated', false);
end $$;
create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
  perform set_config('role', 'anon', false);
end $$;
create function t.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FALHOU: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;
-- executa p_sql esperando erro cuja mensagem/detalhe contenha p_like
create function t.fails(p_sql text, p_like text, p_label text) returns void language plpgsql as $$
declare v_msg text; v_detail text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
    if (v_msg || ' ' || coalesce(v_detail, '')) ilike '%' || p_like || '%' then
      raise notice 'ok - %', p_label;
      return;
    end if;
    raise exception 'FALHOU: % — erro inesperado: % / %', p_label, v_msg, v_detail;
  end;
  raise exception 'FALHOU: % — a operação deveria ter sido negada', p_label;
end $$;
-- conta linhas afetadas por um UPDATE/DELETE (RLS nega silenciosamente com 0 linhas)
create function t.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin execute p_sql; get diagnostics n = row_count; return n; end $$;

-- ------------------------------------------------------------ usuários
with u as (
  insert into auth.users (email, raw_user_meta_data) values
    ('f@t.dev', '{"account_type":"freelancer","display_name":"Fran Freela"}'),
    ('g@t.dev', '{"account_type":"freelancer","display_name":"Gui Freela"}'),
    ('c@t.dev', '{"account_type":"company","display_name":"Carla Contratante"}'),
    ('d@t.dev', '{"account_type":"company","display_name":"Dario Outro"}'),
    ('a@t.dev', '{"account_type":"admin","display_name":"Tentativa de admin"}')
  returning id, email)
insert into t.ids select split_part(email, '@', 1), id from u;

select t.ok((select count(*) from public.profiles) = 5, 'trigger cria perfil para cada usuário');
select t.ok((select account_type from public.profiles where id = t.id('a')) = 'freelancer',
            'account_type inválido no cadastro (admin) cai para freelancer');
select t.ok((select count(*) from public.admin_members) = 0, 'cadastro nunca cria administrador');
select t.ok((select state from public.freelancer_billing where user_id = t.id('f')) = 'FREE_UNLIMITED',
            'freelancer começa em FREE_UNLIMITED');
select t.ok(not exists (select 1 from public.freelancer_billing where user_id = t.id('c')),
            'empresa não tem registro de assinatura de freelancer');

-- empresas são criadas pelo backend (service_role)
insert into public.companies (id, owner_id, person_type, display_name, slug, cnpj_masked)
values ('00000000-0000-0000-0000-0000000000c1', t.id('c'), 'pj', 'Empresa C', 'empresa-c', '12.***.***/0001-**'),
       ('00000000-0000-0000-0000-0000000000d1', t.id('d'), 'pj', 'Empresa D', 'empresa-d', null);
insert into public.company_private (company_id, cnpj, legal_name)
values ('00000000-0000-0000-0000-0000000000c1', '12ABC34501DE35', 'EMPRESA C LTDA');
select t.ok(true, 'company_private aceita CNPJ alfanumérico');

-- ------------------------------------------------------------ escalada de privilégio
select t.login('f');
select t.fails($$update public.profiles set account_type = 'company' where id = t.id('f')$$,
               'permission denied', 'usuário não altera o próprio account_type');
select t.fails($$update public.freelancer_profiles set rating_avg = 5, completed_projects = 99$$,
               'permission denied', 'usuário não altera reputação/contadores');
select t.fails($$insert into public.admin_members (user_id, role) values (t.id('f'), 'super_admin')$$,
               'permission denied', 'usuário não se promove a admin');
select t.fails($$update public.freelancer_billing set state = 'PRO_ACTIVE'$$,
               'permission denied', 'usuário não altera o estado da assinatura');
select t.fails($$insert into public.companies (owner_id, person_type, display_name, slug)
                 values (t.id('f'), 'pj', 'Falsa', 'falsa')$$,
               'permission denied', 'empresa não é criada direto pelo cliente');
select t.fails($$select * from public.webhook_events$$, 'permission denied', 'webhook_events inacessível');
select t.fails($$select * from public.registry_cache$$, 'permission denied', 'registry_cache inacessível');
select t.fails($$select public.process_payment_update(gen_random_uuid(), 'x', 'approved', null, 1)$$,
               'permission denied', 'usuário não executa process_payment_update');
select t.ok((select count(*) from public.profile_private) = 1, 'profile_private: só a própria linha');
select t.ok((select count(*) from public.company_private) = 0, 'company_private invisível para terceiros');
select t.ok(t.affected($$update public.profiles set display_name = 'hack' where id = t.id('g')$$) = 0,
            'não altera perfil de outro usuário');
select t.ok(t.affected($$update public.profiles set display_name = 'Fran F.' where id = t.id('f')$$) = 1,
            'altera o próprio perfil');
reset role;

select t.anon();
select t.fails($$select * from public.profile_private$$, 'permission denied', 'anon: profile_private negado');
select t.fails($$select * from public.company_private$$, 'permission denied', 'anon: company_private negado');
select t.fails($$select * from public.proposals$$, 'permission denied', 'anon: propostas negadas');
select t.fails($$select * from public.messages$$, 'permission denied', 'anon: mensagens negadas');
select t.ok((select count(*) from public.profiles) = 0, 'anon não lista perfis não públicos');
select t.ok((select count(*) from public.categories) = 11, 'anon lê as 11 categorias iniciais');
select t.ok((select count(*) from public.plans) = 3, 'planos ativos com preço são públicos');
reset role;

-- ------------------------------------------------------------ projetos
select t.login('c');
insert into public.projects (id, company_id, created_by, title, description, category_id, budget_type,
                             budget_min_cents, budget_max_cents, deadline_days, status)
select '00000000-0000-0000-0000-00000000aaa1', '00000000-0000-0000-0000-0000000000c1', t.id('c'),
       'Dashboard de vendas em Power BI', 'Preciso de um dashboard de vendas com metas e filtros por região.',
       id, 'range', 100000, 200000, 15, 'open' from public.categories where slug = 'dados-e-inteligencia-empresarial';
insert into public.projects (id, company_id, created_by, kind, title, description, category_id, budget_type,
                             budget_min_cents, deadline_days, status)
select '00000000-0000-0000-0000-00000000aaa2', '00000000-0000-0000-0000-0000000000c1', t.id('c'), 'quick',
       'Ajustar fórmula em planilha', 'Corrigir uma fórmula de PROCV que retorna erro em uma planilha.',
       id, 'fixed', 15000, 2, 'open' from public.categories where slug = 'administracao-e-financeiro';
select t.ok((select published_at is not null from public.projects where id = '00000000-0000-0000-0000-00000000aaa1'),
            'published_at preenchido ao abrir');
select t.fails($$insert into public.projects (company_id, created_by, kind, title, description, category_id, budget_type, status)
                 select '00000000-0000-0000-0000-0000000000c1', t.id('c'), 'quick', 'Bico rápido sem preço',
                        'Descrição suficientemente longa para passar na validação.', id, 'open', 'open'
                 from public.categories limit 1$$, 'check constraint', 'Bico Rápido exige preço fechado e prazo curto');
select t.fails($$select public.submit_proposal('00000000-0000-0000-0000-00000000aaa1', 1000, 5, 'Proposta da própria empresa aqui')$$,
               'Apenas freelancers', 'conta empresa não envia proposta');
reset role;

select t.login('d');
select t.fails($$insert into public.projects (company_id, created_by, title, description, category_id, status)
                 select '00000000-0000-0000-0000-0000000000c1', t.id('d'), 'Projeto em empresa alheia',
                        'Descrição suficientemente longa para passar na validação.', id, 'open'
                 from public.categories limit 1$$, 'row-level security', 'não publica projeto em empresa de terceiro');
select t.ok(t.affected($$update public.projects set title = 'Título alterado por terceiro'$$) = 0,
            'não edita projeto de outra empresa');
reset role;

-- ------------------------------------------------------------ propostas
select t.login('f');
select t.fails($$insert into public.proposals (project_id, freelancer_id, amount_cents, deadline_days, cover_letter)
                 values ('00000000-0000-0000-0000-00000000aaa1', t.id('f'), 1, 1, 'insert direto sem passar pela cota')$$,
               'permission denied', 'proposta só entra via submit_proposal');
select id as prop_f from public.submit_proposal('00000000-0000-0000-0000-00000000aaa1', 150000, 10,
                              'Tenho experiência com Power BI e modelagem de dados.') \gset
select t.fails($$select public.submit_proposal('00000000-0000-0000-0000-00000000aaa1', 150000, 10, 'Segunda proposta no mesmo projeto.')$$,
               'duplicate key', 'uma proposta por projeto');
select t.fails($$update public.proposals set status = 'accepted'$$, 'row-level security',
               'freelancer não aceita a própria proposta');
reset role;

select t.login('g');
select t.ok((select count(*) from public.proposals) = 0, 'outro freelancer não vê propostas alheias');
select public.submit_proposal('00000000-0000-0000-0000-00000000aaa1', 180000, 12,
                              'Proposta do segundo freelancer para o dashboard.') \gset g_
reset role;

select t.login('c');
select t.ok((select count(*) from public.proposals) = 2, 'empresa vê as propostas do seu projeto');
select t.fails($$update public.proposals set amount_cents = 1 where freelancer_id = t.id('f')$$,
               'Somente o autor', 'empresa não altera o valor da proposta');
select t.ok(t.affected($$update public.proposals set status = 'shortlisted' where freelancer_id = t.id('g')$$) = 1,
            'empresa pré-seleciona proposta');
reset role;

select t.login('d');
select t.fails(format($$select public.accept_proposal(%L)$$, :'prop_f'),
               'Somente a empresa dona', 'empresa terceira não aceita proposta');
reset role;

-- ------------------------------------------------------------ contrato + pagamento por webhook
select t.login('c');
select id as contract_id from public.accept_proposal(:'prop_f') \gset
select t.ok((select (status, deposit_cents, balance_cents) = ('awaiting_freelancer', 15000::bigint, 135000::bigint)
               from public.contracts where id = :'contract_id'), 'contrato criado com entrada de 10%');
select t.fails(format($$select public.confirm_contract(%L)$$, :'contract_id'), 'não encontrado',
               'empresa não confirma no lugar do freelancer');
reset role;

select t.login('g');
select t.ok((select count(*) from public.contracts) = 0, 'terceiro não vê o contrato');
reset role;

select t.login('f');
select public.confirm_contract(:'contract_id') \gset c_
select t.ok((select status from public.contracts where id = :'contract_id') = 'awaiting_deposit',
            'freelancer confirma -> aguardando entrada');
select t.fails(format($$select public.deliver_contract(%L, 'entrega antes do pagamento')$$, :'contract_id'),
               'não está em execução', 'não entrega antes da entrada confirmada');
reset role;

select id as payment_id from public.payments where contract_id = :'contract_id' \gset
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'approved', 'accredited', 14999) = 'amount_mismatch',
            'valor divergente não aprova pagamento');
select t.ok((select status from public.contracts where id = :'contract_id') = 'awaiting_deposit',
            'contrato não inicia com valor divergente');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'pending', 'pending_waiting_transfer', 15000) = 'pending',
            'pagamento pendente não inicia contrato');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'approved', 'accredited', 15000) = 'approved',
            'pagamento aprovado');
select t.ok((select (status, is_first_bico) = ('active', true) from public.contracts where id = :'contract_id'),
            'contrato ativo e marcado como primeiro bico');
select t.ok((select state from public.freelancer_billing where user_id = t.id('f')) = 'FIRST_PROJECT_ACTIVE',
            'assinatura -> FIRST_PROJECT_ACTIVE');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'approved', 'accredited', 15000) = 'approved',
            'webhook repetido é idempotente');
select t.ok((select count(*) from public.subscription_events where user_id = t.id('f')) = 1,
            'webhook repetido não duplica transição');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'pending', null, 15000) = 'ignored_regression',
            'pagamento aprovado não regride para pendente');
select t.ok((select status from public.projects where id = '00000000-0000-0000-0000-00000000aaa1') = 'in_progress',
            'projeto sai de aberto quando a vaga é preenchida');

select t.login('f');
select public.deliver_contract(:'contract_id', 'Dashboard publicado, segue o link.');
select t.fails(format($$select public.approve_delivery(%L)$$, :'contract_id'), 'não encontrado',
               'freelancer não aprova a própria entrega');
reset role;
select t.login('c');
select public.approve_delivery(:'contract_id');
reset role;
select t.ok((select status from public.contracts where id = :'contract_id') = 'completed', 'contrato concluído');
select t.ok((select completed_projects from public.freelancer_profiles where user_id = t.id('f')) = 1,
            'contador de projetos concluídos');
select t.ok((select state from public.freelancer_billing where user_id = t.id('f')) = 'FIRST_PROJECT_COMPLETED',
            'assinatura -> FIRST_PROJECT_COMPLETED');

-- ------------------------------------------------------------ Bico BR Pro
select t.login('f');
select t.fails($$select public.submit_proposal('00000000-0000-0000-0000-00000000aaa2', 15000, 2, 'Resolvo a fórmula ainda hoje.')$$,
               'PRO_REQUIRED', 'após o primeiro bico, nova proposta exige Pro');
reset role;
update public.plans set is_active = false where code = 'premium';
select t.login('f');
select t.fails($$select public.request_pro('premium', true)$$, 'Plano indisponível', 'plano inativo não é vendido');
select t.fails($$select public.request_pro('pro', false)$$, 'CONSENT_REQUIRED', 'sem consentimento expresso não há assinatura');
select id as sub_payment_id from public.request_pro('pro', true) \gset
select t.ok((select state from public.freelancer_billing) = 'PRO_PENDING_ACTIVATION', 'consentimento -> PRO_PENDING_ACTIVATION');
select t.ok((select consent_snapshot ->> 'price_cents' from public.freelancer_billing) = '2990',
            'consentimento guarda o preço exibido');
select t.fails($$select public.submit_proposal('00000000-0000-0000-0000-00000000aaa2', 15000, 2, 'Resolvo a fórmula ainda hoje.')$$,
               'PRO_REQUIRED', 'pendente de pagamento ainda não libera propostas');
reset role;
select t.ok(public.process_payment_update(:'sub_payment_id', 'MP-2', 'approved', 'accredited', 2990) = 'approved',
            'pagamento da assinatura aprovado');
select t.ok((select (state, proposals_used) = ('PRO_ACTIVE', 0) and cycle_end > now() + interval '29 days'
               from public.freelancer_billing where user_id = t.id('f')), 'PRO_ACTIVE com ciclo de 30 dias');
select t.login('f');
select public.submit_proposal('00000000-0000-0000-0000-00000000aaa2', 15000, 2, 'Resolvo a fórmula ainda hoje.') \gset q_
select t.ok((select proposals_used from public.freelancer_billing) = 1, 'proposta consome a cota do ciclo');
reset role;
update public.freelancer_billing set proposals_used = 10 where user_id = t.id('f');
update public.projects set status = 'open' where id = '00000000-0000-0000-0000-00000000aaa1';
delete from public.proposals where freelancer_id = t.id('g');
select t.login('f');
select public.cancel_pro();
select t.ok((select state from public.freelancer_billing) = 'PRO_CANCELLED', 'cancelamento -> PRO_CANCELLED');
reset role;
update public.freelancer_billing set cycle_end = now() - interval '1 minute' where user_id = t.id('f');
select t.ok(public.expire_subscriptions() = 1, 'ciclo vencido expira');
select t.ok((select state from public.freelancer_billing where user_id = t.id('f')) = 'PRO_EXPIRED', '-> PRO_EXPIRED');
select t.ok((select status from public.contracts where id = :'contract_id') = 'completed',
            'expiração não altera contratos');

-- cota esgotada (g vira Pro com cota cheia)
update public.freelancer_billing
   set state = 'PRO_ACTIVE', plan_id = (select id from public.plans where code = 'pro'),
       cycle_start = now(), cycle_end = now() + interval '30 days', proposals_used = 10
 where user_id = t.id('g');
select t.login('g');
select t.fails($$select public.submit_proposal('00000000-0000-0000-0000-00000000aaa1', 180000, 12, 'Proposta além da cota do ciclo.')$$,
               'QUOTA_EXCEEDED', 'cota do ciclo é respeitada');
reset role;

-- ------------------------------------------------------------ avaliações
select t.login('g');
select t.fails(format($$insert into public.reviews (contract_id, reviewer_id, rating) values (%L, t.id('g'), 1)$$, :'contract_id'),
               'Somente as partes', 'terceiro não avalia contrato');
reset role;
select t.login('c');
insert into public.reviews (contract_id, reviewer_id, rating, comment) values (:'contract_id', t.id('c'), 5, 'Entrega excelente.');
reset role;
select t.ok((select (rating_avg, rating_count) = (5.00, 1) from public.freelancer_profiles where user_id = t.id('f')),
            'avaliação atualiza a reputação do freelancer');
select t.login('f');
insert into public.reviews (contract_id, reviewer_id, rating) values (:'contract_id', t.id('f'), 4);
reset role;
select t.ok((select rating_avg from public.companies where slug = 'empresa-c') = 4.00, 'avaliação atualiza a empresa');

-- ------------------------------------------------------------ portfólio
select t.login('f');
insert into public.portfolio_items (user_id, title) values (t.id('f'), 'Trabalho externo');
select t.fails($$insert into public.portfolio_items (user_id, title, origin, contract_id)
                 values (t.id('f'), 'Selo indevido', 'bico_br', gen_random_uuid())$$,
               'row-level security', 'selo Bico BR exige contrato concluído real');
insert into public.portfolio_items (user_id, title, origin, contract_id, visibility)
values (t.id('f'), 'Dashboard feito no Bico BR', 'bico_br', :'contract_id', 'private');
reset role;
select t.login('g');
select t.ok((select count(*) from public.portfolio_items) = 1, 'item privado do portfólio não aparece para terceiros');
select t.fails($$insert into public.portfolio_items (user_id, title, origin, contract_id)
                 values (t.id('g'), 'Selo com contrato alheio', 'bico_br', (select id from public.contracts limit 1))$$,
               'row-level security', 'não usa contrato de outro freelancer para obter selo');
reset role;
select t.anon();
select t.ok((select count(*) from public.portfolio_items) = 0, 'anon não vê portfólio de perfil não público');
reset role;

-- ------------------------------------------------------------ chat
select t.login('g');
select t.fails(format($$select public.start_project_conversation('00000000-0000-0000-0000-00000000aaa1', %L)$$, t.id('f')),
               'Sem permissão', 'terceiro não abre conversa entre outras partes');
reset role;
select t.login('c');
select public.start_project_conversation('00000000-0000-0000-0000-00000000aaa1', t.id('f')) as conv_id \gset
select t.ok(public.start_project_conversation('00000000-0000-0000-0000-00000000aaa1', t.id('f')) = :'conv_id',
            'conversa não é duplicada');
select t.fails(format($$select public.start_project_conversation('00000000-0000-0000-0000-00000000aaa1', %L)$$, t.id('g')),
               'proposta ou convite', 'sem proposta/convite não há conversa');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_id', t.id('c'), 'Olá, podemos alinhar o escopo?');
reset role;
select t.login('g');
select t.ok((select count(*) from public.messages) = 0, 'não participante não lê mensagens');
select t.ok((select count(*) from public.conversations) = 0, 'não participante não vê a conversa');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, body) values (%L, t.id('g'), 'intruso')$$, :'conv_id'),
               'row-level security', 'não participante não envia mensagem');
reset role;
select t.login('f');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, body) values (%L, t.id('c'), 'falsificando remetente')$$, :'conv_id'),
               'row-level security', 'não envia mensagem em nome de outro');
select t.ok((select count(*) from public.messages) = 1, 'participante lê a conversa');
insert into public.user_blocks (blocker_id, blocked_id) values (t.id('f'), t.id('c'));
reset role;
select t.login('c');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, body) values (%L, t.id('c'), 'depois do bloqueio')$$, :'conv_id'),
               'Não é possível enviar', 'usuário bloqueado não envia mensagem');
reset role;

-- ------------------------------------------------------------ disputa
select t.login('f');
select protocol from public.open_dispute(:'contract_id', 'nao_pagamento', 'O saldo combinado não foi pago após a aprovação.') \gset
select t.ok(:'protocol' ~ '^BICO-[0-9]{4}-[0-9]{6}$', 'disputa gera protocolo');
select t.fails(format($$select public.open_dispute(%L, 'outro', 'Segunda disputa simultânea no mesmo contrato.')$$, :'contract_id'),
               'Já existe uma disputa', 'uma disputa aberta por contrato');
reset role;
select t.login('g');
select t.ok((select count(*) from public.disputes) = 0, 'terceiro não vê disputas');
reset role;

-- ------------------------------------------------------------ 0011/0012: endurecimento e modelo comercial
select t.login('f');
select t.fails($$select private.billing_transition(t.id('f'), 'PRO_ACTIVE', 'hack')$$, 'permission denied',
               'função interna de assinatura não é executável por usuários');
select t.fails($$select private.activate_contract(gen_random_uuid(), null)$$, 'permission denied',
               'função interna de contrato não é executável por usuários');
select t.fails($$select private.notify(t.id('c'), 'spam', '{}')$$, 'permission denied',
               'usuário não fabrica notificações para terceiros');
select t.fails($$select public.admin_metrics(30)$$, 'Acesso negado', 'indicadores negados a não administradores');
select t.fails($$update public.freelancer_profiles set links = (select jsonb_agg(i) from generate_series(1, 50) i)$$,
               'fp_links_size', 'limite de tamanho em campos JSON');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, body) values (%L, t.id('f'), repeat('x', 5000))$$, :'conv_id'),
               'violates check', 'mensagem acima do limite é recusada');
reset role;
select t.login('g');
select t.fails(format($$select public.declare_balance_paid(%L)$$, :'contract_id'), 'não encontrado', 'terceiro não declara saldo');
reset role;
select t.login('f');
select t.fails(format($$select public.declare_balance_paid(%L)$$, :'contract_id'), 'não encontrado', 'profissional não declara pagamento no lugar da empresa');
reset role;
select t.login('c');
select public.declare_balance_paid(:'contract_id');
select t.fails(format($$select public.declare_balance_paid(%L)$$, :'contract_id'), 'uma vez', 'saldo é declarado uma única vez');
select t.fails(format($$select public.confirm_balance_received(%L)$$, :'contract_id'), 'não encontrado', 'empresa não confirma recebimento pelo profissional');
reset role;
select t.login('f');
select public.confirm_balance_received(:'contract_id');
reset role;
select t.ok((select balance_declared_paid_at is not null and balance_confirmed_at is not null from public.contracts where id = :'contract_id'),
            'saldo declarado e confirmado ficam registrados');

-- compra do Pro: sem cobrança em dobro e com desistência
select t.login('f');
select id as renew_1 from public.request_pro('pro', true) \gset
select id as renew_2 from public.request_pro('pro', true) \gset
select t.ok(:'renew_1' = :'renew_2', 'pedir o plano duas vezes devolve a mesma cobrança pendente');
select t.ok((select consent_snapshot ->> 'auto_renew' from public.freelancer_billing) = 'false', 'consentimento registra que não há renovação automática');
select public.abandon_pro_request();
select t.ok((select state from public.freelancer_billing) = 'PRO_EXPIRED', 'desistência volta ao estado anterior');
reset role;
select t.ok((select status from public.payments where id = :'renew_1') = 'cancelled', 'cobrança abandonada é cancelada');

-- administração exige MFA
insert into public.admin_members (user_id, role) values (t.id('a'), 'support'), (t.id('d'), 'finance');
select id as dispute_id from public.disputes limit 1 \gset
select t.login('a', 'aal1');
select t.ok((select count(*) from public.disputes) = 0, 'admin sem MFA não enxerga disputas');
select t.fails(format($$select public.resolve_dispute(%L, 'Decisão tomada sem segundo fator de autenticação.', 'resume')$$, :'dispute_id'),
               'Acesso negado', 'admin sem MFA não decide disputa');
select t.ok((select count(*) from public.admin_members) = 1, 'admin sem MFA só vê o próprio vínculo');
reset role;
select t.login('a', 'aal2');
select t.ok((select count(*) from public.disputes) = 1, 'admin de suporte com MFA enxerga disputas');
select t.fails($$select public.admin_metrics(30)$$, 'Acesso negado', 'suporte não acessa indicadores financeiros');
select t.ok(t.affected($$update public.plans set price_cents = 1 where code = 'pro'$$) = 0, 'suporte não altera preço de plano');
select t.fails(format($$select public.resolve_dispute(%L, 'curta', 'resume')$$, :'dispute_id'), 'justificativa', 'decisão exige justificativa');
select public.resolve_dispute(:'dispute_id', 'Comprovante de pagamento do saldo apresentado pela empresa.', 'resume');
reset role;
select t.ok((select status from public.disputes where id = :'dispute_id') = 'resolved', 'disputa resolvida');
select t.ok((select count(*) from public.audit_logs where entity_type = 'disputes' and action = 'update') >= 1, 'decisão da disputa fica na auditoria');
select t.login('d', 'aal2');
select t.ok((public.admin_metrics(30) ->> 'contratos_concluidos')::int = 1, 'financeiro com MFA lê indicadores');
select t.ok((public.admin_metrics(30) ->> 'receita_taxa_servico_centavos')::int = 15000, 'receita = taxa de serviço recebida, não o GMV');
select t.ok((public.admin_metrics(30) ->> 'gmv_centavos')::int = 150000, 'GMV separado da receita');
select t.ok(t.affected($$update public.plans set price_cents = 3490 where code = 'pro'$$) = 1, 'financeiro altera preço de plano');
reset role;
select t.ok((select count(*) from public.audit_logs where entity_type = 'plans' and actor_id = t.id('d')) = 1, 'alteração de preço é auditada com autor');


-- ------------------------------------------------------------ vagas: somente remoto
select t.fails($$insert into public.jobs (company_id, created_by, title, description, category_id, contract_type, work_mode)
                 select '00000000-0000-0000-0000-0000000000c1', t.id('c'), 'Analista de marketing',
                        'Vaga híbrida que não deve entrar na base remota.', id, 'clt', 'hybrid'
                 from public.categories limit 1$$, 'check constraint', 'vaga não remota é recusada pelo banco');

-- ------------------------------------------------------------ auditoria
select t.ok((select count(*) from public.audit_logs where entity_type = 'payments') >= 4, 'pagamentos são auditados');
select t.ok((select count(*) from public.audit_logs where entity_type = 'contracts') >= 5, 'contratos são auditados');
select t.fails($$delete from public.audit_logs$$, 'somente inserção', 'audit_logs não pode ser apagado');
select t.fails($$update public.audit_logs set action = 'x'$$, 'somente inserção', 'audit_logs não pode ser alterado');

-- ------------------------------------------------------------ toda tabela com RLS
select t.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
            'todas as tabelas do schema public têm RLS habilitado');
select t.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'toda função SECURITY DEFINER fixa o search_path');

drop schema t cascade;
\echo 'TODOS OS TESTES DE BANCO PASSARAM'
