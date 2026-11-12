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

-- ------------------------------------------------------------ plano único (0017)
select t.ok((select (price_cents, proposals_per_cycle is null) = (2500::bigint, true) from public.plans where code = 'pro'),
            'plano Pro: R$ 25,00 com propostas ilimitadas');
select t.ok((select count(*) from public.plans where is_active) = 1, 'há um único plano à venda');
-- os testes abaixo exercitam o mecanismo de cota, que continua existindo para planos que venham a ter limite
update public.plans set price_cents = 2990, proposals_per_cycle = 10 where code = 'pro';
update public.plans set is_active = true where code in ('pro_plus', 'premium');

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
select t.ok((select count(*) from public.categories) = 2, 'anon lê só as categorias de tecnologia ativas');
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
       id, 'fixed', 15000, 2, 'open' from public.categories where slug = 'tecnologia-e-programacao';
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
select t.ok((select (status, deposit_cents, balance_cents) = ('awaiting_freelancer', 15000::bigint, 150000::bigint)
               from public.contracts where id = :'contract_id'), 'contrato: taxa de 10% por cima; profissional recebe 100% do valor proposto');
select t.fails(format($$select public.confirm_contract(%L)$$, :'contract_id'), 'não encontrado',
               'empresa não confirma no lugar do freelancer');
reset role;

select t.login('g');
select t.ok((select count(*) from public.contracts) = 0, 'terceiro não vê o contrato');
reset role;

select t.login('f');
select t.fails(format($$select public.confirm_contract(%L)$$, :'contract_id'), 'MP_NOT_CONNECTED', 'sem conta Mercado Pago conectada o profissional não confirma contrato');
select t.fails($$update public.freelancer_profiles set mp_connected = true where user_id = t.id('f')$$, 'permission denied', 'usuário não marca a própria conta como conectada');
select t.fails($$select * from public.mp_accounts$$, 'permission denied', 'tokens do Mercado Pago inacessíveis pela API');
reset role;
update public.freelancer_profiles set mp_connected = true where user_id in (t.id('f'), t.id('g')); -- feito pelo backend após o OAuth
select t.login('f');
select public.confirm_contract(:'contract_id') \gset c_
select t.ok((select status from public.contracts where id = :'contract_id') = 'awaiting_deposit',
            'freelancer confirma -> aguardando entrada');
select t.fails(format($$select public.deliver_contract(%L, 'entrega antes do pagamento')$$, :'contract_id'),
               'não está em execução', 'não entrega antes da entrada confirmada');
reset role;

select id as payment_id from public.payments where contract_id = :'contract_id' \gset
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'approved', 'accredited', 164999) = 'amount_mismatch',
            'valor divergente não aprova pagamento');
select t.ok((select status from public.contracts where id = :'contract_id') = 'awaiting_deposit',
            'contrato não inicia com valor divergente');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'pending', 'pending_waiting_transfer', 165000) = 'pending',
            'pagamento pendente não inicia contrato');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'approved', 'accredited', 165000) = 'approved',
            'pagamento aprovado');
select t.ok((select (status, is_first_bico) = ('active', true) from public.contracts where id = :'contract_id'),
            'contrato ativo e marcado como primeiro bico');
select t.ok((select state from public.freelancer_billing where user_id = t.id('f')) = 'FIRST_PROJECT_ACTIVE',
            'assinatura -> FIRST_PROJECT_ACTIVE');
select t.ok((select (status, amount_cents, payment_reference) = ('paid', 150000::bigint, 'Mercado Pago (split)') from public.payouts where contract_id = :'contract_id'),
            'pagamento confirmado: a parte do profissional é destinada a ele pelo Mercado Pago (a plataforma não guarda)');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'approved', 'accredited', 165000) = 'approved',
            'webhook repetido é idempotente');
select t.ok((select count(*) from public.subscription_events where user_id = t.id('f')) = 1,
            'webhook repetido não duplica transição');
select t.ok(public.process_payment_update(:'payment_id', 'MP-1', 'pending', null, 165000) = 'ignored_regression',
            'pagamento aprovado não regride para pendente');
select t.ok((select status from public.projects where id = '00000000-0000-0000-0000-00000000aaa1') = 'in_progress',
            'projeto sai de aberto quando a vaga é preenchida');

select t.login('f');
select t.fails(format($$select public.deliver_contract(%L, 'Entrega parcial sem os itens.', '[{"id": 999999, "note": "x"}]')$$, :'contract_id'),
               'ITEMS_MISSING', 'entrega precisa cobrir todos os itens do contrato');
select t.fails(format($$update public.contract_deliverables set status = 'accepted' where contract_id = %L$$, :'contract_id'),
               'permission denied', 'profissional não valida a própria entrega');
select t.fails(format($$update public.payouts set status = 'released' where contract_id = %L$$, :'contract_id'),
               'permission denied', 'profissional não libera o próprio crédito');
select public.deliver_contract(:'contract_id', 'Dashboard publicado, segue o link.',
  (select jsonb_agg(jsonb_build_object('id', id, 'note', 'Arquivo final', 'url', 'https://exemplo.dev/entrega')) from public.contract_deliverables where contract_id = :'contract_id'));
select t.ok((select count(*) from public.contract_deliverables where contract_id = :'contract_id' and status = 'delivered' and delivery_url is not null) = 1,
            'entrega fica mapeada item a item dentro da plataforma');
select t.ok((select status from public.contracts where id = :'contract_id') = 'delivered', 'entrega registrada aguarda validação da empresa');
select t.fails(format($$select public.approve_delivery(%L)$$, :'contract_id'), 'não encontrado',
               'freelancer não aprova a própria entrega');
reset role;
select t.login('c');
select public.approve_delivery(:'contract_id');
reset role;
select t.ok((select status from public.contracts where id = :'contract_id') = 'completed', 'contrato concluído');
select t.ok((select status from public.payouts where contract_id = :'contract_id') = 'paid', 'registro do repasse permanece após a validação');
select t.ok((select count(*) from public.contract_deliverables where contract_id = :'contract_id' and status = 'accepted') = 1, 'itens ficam marcados como aceitos');
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
select t.ok((select status from public.disputes where contract_id = :'contract_id' order by created_at desc limit 1) = 'open', 'reclamação aberta fica registrada para análise');
select t.login('g');
select t.ok((select count(*) from public.payouts) = 0, 'terceiro não vê créditos alheios');
select t.ok((select count(*) from public.contract_deliverables) = 0, 'terceiro não vê entregas alheias');
reset role;

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
select t.ok((select status from public.contracts where id = :'contract_id') = 'completed', 'decisão favorável ao profissional mantém o contrato concluído');
select id as payout_id from public.payouts where contract_id = :'contract_id' \gset
select t.login('a', 'aal2');
select t.fails(format($$select public.mark_payout_paid(%L, 'PIX-123456')$$, :'payout_id'), 'Acesso negado', 'suporte não registra repasse');
reset role;
select t.login('f');
select t.fails(format($$select public.mark_payout_paid(%L, 'PIX-123456')$$, :'payout_id'), 'Acesso negado', 'profissional não marca o próprio repasse como pago');
reset role;
select t.login('d', 'aal2');
select t.fails(format($$select public.mark_payout_paid(%L, 'PIX-OUTRO')$$, :'payout_id'), 'crédito liberado', 'repasse feito pelo Mercado Pago não é regravado à mão');
reset role;
select t.ok((select count(*) from public.audit_logs where entity_type = 'payouts') >= 1, 'registro do repasse é auditado');
select t.ok((select count(*) from public.audit_logs where entity_type = 'disputes' and action = 'update') >= 1, 'decisão da disputa fica na auditoria');
select t.login('d', 'aal2');
select t.ok((public.admin_metrics(30) ->> 'contratos_concluidos')::int = 1, 'financeiro com MFA lê indicadores');
select t.ok((public.admin_metrics(30) ->> 'receita_taxa_servico_centavos')::int = 15000, 'taxa de projeto concluído (entrega validada) é receita');
select t.ok((public.admin_metrics(30) ->> 'taxa_a_reconhecer_centavos')::int = 0, 'nada pendente de reconhecimento');
select t.ok((public.admin_metrics(30) ->> 'gmv_centavos')::int = 150000, 'GMV separado da receita');
select t.ok(t.affected($$update public.plans set price_cents = 3490 where code = 'pro'$$) = 1, 'financeiro altera preço de plano');
reset role;
select t.ok((select count(*) from public.audit_logs where entity_type = 'plans' and actor_id = t.id('d')) = 1, 'alteração de preço é auditada com autor');


-- ------------------------------------------------------------ 0013: casos de borda de pagamento
-- (a) plano pago depois da desistência: dinheiro recebido é honrado
select t.ok(public.process_payment_update(:'renew_1', 'MP-9', 'pending', null, 2990) = 'ignored_cancelled',
            'cobrança cancelada por nós não volta a pendente');
select t.ok(public.process_payment_update(:'renew_1', 'MP-9', 'approved', 'accredited', 2990) = 'approved',
            'pagamento aprovado após desistência é aceito (não trava o webhook)');
select t.ok((select state from public.freelancer_billing where user_id = t.id('f')) = 'PRO_ACTIVE',
            'plano pago é ativado mesmo após desistência');
select t.ok(public.process_payment_update(:'renew_1', 'MP-OUTRO', 'approved', 'accredited', 2990) = 'provider_id_conflict',
            'registro aprovado não é reassociado a outro pagamento do provedor');
-- (b) segundo pagamento de plano com plano vigente => reembolso automático, sem sobrepor ciclo
insert into public.payments (id, kind, plan_id, payer_id, amount_cents)
select '00000000-0000-0000-0000-0000000000f2', 'subscription', id, t.id('f'), 5990 from public.plans where code = 'pro_plus';
select cycle_end as end_before from public.freelancer_billing where user_id = t.id('f') \gset
select t.ok(public.process_payment_update('00000000-0000-0000-0000-0000000000f2', 'MP-10', 'approved', 'accredited', 5990) = 'approved',
            'pagamento com assinatura vigente vale como renovação');
select t.ok((select cycle_end = :'end_before'::timestamptz + interval '30 days' from public.freelancer_billing where user_id = t.id('f')),
            'renovação soma 30 dias ao fim do período vigente: nenhum dia pago é perdido');
-- (c) taxa de serviço paga para contrato cancelado
update public.freelancer_billing set proposals_used = 0 where user_id = t.id('g');
select t.login('g');
select id as prop_g2 from public.submit_proposal('00000000-0000-0000-0000-00000000aaa2', 15000, 2, 'Faço o ajuste da planilha hoje mesmo.') \gset
reset role;
select t.login('c');
select id as contract_2 from public.accept_proposal(:'prop_g2') \gset
reset role;
select t.login('g');
select public.confirm_contract(:'contract_2') \gset x_
reset role;
select id as pay_2 from public.payments where contract_id = :'contract_2' \gset
select t.login('c');
select public.cancel_contract(:'contract_2', 'Desisti do serviço');
reset role;
select t.ok(public.process_payment_update(:'pay_2', 'MP-11', 'approved', 'accredited', 16500) = 'approved_needs_refund',
            'taxa paga para contrato cancelado gera reembolso automático');
select t.ok((select status from public.contracts where id = :'contract_2') = 'cancelled', 'contrato cancelado não é reativado por pagamento tardio');
select t.ok((select count(*) from public.refunds where origin = 'system' and status = 'requested') = 1, 'reembolso automático fica na fila do financeiro');
select t.login('d', 'aal2');
select t.ok((select count(*) from public.refunds) = 1, 'financeiro com MFA vê os reembolsos');
select t.ok(t.affected(format($$update public.refunds set status = 'approved', decided_by = %L, decided_at = now(), decision_note = 'Devolver' where payment_id = %L$$, t.id('d'), :'pay_2')) = 1,
            'financeiro decide o reembolso');
select t.ok(t.affected($$update public.refunds set status = 'processed'$$) = 0, 'reembolso já decidido não é alterado de novo pela API');
reset role;
select t.login('c');
select t.ok((select count(*) from public.refunds) = 0, 'empresa não vê reembolsos automáticos de terceiros nem os do sistema');
reset role;
-- empresa some após a entrega: aprovação automática libera o crédito
update public.projects set status = 'open' where id = '00000000-0000-0000-0000-00000000aaa2';
update public.proposals set status = 'sent' where id = :'prop_g2';
delete from public.contracts where id = :'contract_2' and false;
select t.ok(public.auto_approve_deliveries() = 0, 'nada a aprovar automaticamente antes do prazo');
select t.ok(public.purge_expired_cache() >= 0, 'limpeza agendada executa');
select t.login('f');
select t.fails($$select public.purge_expired_cache()$$, 'permission denied', 'usuário não executa a limpeza');
select t.fails($$select public.auto_approve_deliveries()$$, 'permission denied', 'usuário não dispara a aprovação automática');
reset role;

-- ------------------------------------------------------------ 0014: anúncios
select t.login('d', 'aal2');
insert into public.ad_campaigns (id, advertiser_name, image_path, image_alt, target_url, placement, ends_at, status, price_cents, internal_note, created_by)
values ('00000000-0000-0000-0000-00000000ad01', 'Acme Cursos', 'acme/banner-power-bi.png', 'Formação em Power BI da Acme Cursos', 'https://acme.example/curso', 'feed_inline', now() + interval '30 days', 'active', 150000, 'Fechado por 30 dias', t.id('d')),
       ('00000000-0000-0000-0000-00000000ad02', 'Rascunho SA', null, null, 'https://rascunho.example', 'feed_inline', now() + interval '30 days', 'draft', 1, null, t.id('d'));
select t.fails($$update public.ad_campaigns set status = 'active' where id = '00000000-0000-0000-0000-00000000ad02'$$,
               'ad_campaigns_live_needs_image', 'campanha não vai ao ar sem imagem');
select t.fails($$update public.ad_campaigns set image_path = 'acme/banner.svg' where id = '00000000-0000-0000-0000-00000000ad02'$$,
               'check constraint', 'imagem SVG é recusada (pode carregar script)');
select t.fails($$update public.ad_campaigns set image_path = '../../etc/passwd.png' where id = '00000000-0000-0000-0000-00000000ad02'$$,
               'check constraint', 'caminho de imagem fora do padrão é recusado');
select t.fails($$insert into public.ad_campaigns (advertiser_name, target_url, placement, ends_at, created_by)
                 values ('Golpe', 'javascript:alert(1)', 'sidebar', now() + interval '1 day', t.id('d'))$$,
               'check constraint', 'anúncio só aceita destino https');
reset role;
select t.anon();
select t.ok((select count(*) from public.live_ads('feed_inline')) = 1, 'visitante vê só anúncio ativo e aprovado');
select t.fails($$select price_cents from public.ad_campaigns$$, 'permission denied', 'visitante não lê preço nem nota interna do anúncio');
select public.ad_event('00000000-0000-0000-0000-00000000ad01', 'click');
select public.ad_event('00000000-0000-0000-0000-00000000ad02', 'click');
reset role;
select t.ok((select clicks from public.ad_campaigns where id = '00000000-0000-0000-0000-00000000ad01') = 1, 'clique é contado em total agregado');
select t.ok((select clicks from public.ad_campaigns where id = '00000000-0000-0000-0000-00000000ad02') = 0, 'anúncio não aprovado não recebe eventos');
select t.login('f');
select t.ok((select count(*) from public.ad_campaigns) = 0, 'usuário comum não lista campanhas (nem preço)');
select t.fails($$insert into public.ad_campaigns (advertiser_name, image_path, image_alt, target_url, placement, ends_at, status, created_by)
                 values ('Eu mesmo', 'eu/banner.png', 'Anúncio grátis', 'https://eu.example', 'home_banner', now() + interval '1 day', 'active', t.id('f'))$$,
               'row-level security', 'usuário comum não publica anúncio por conta própria');
insert into public.ad_requests (user_id, company_name, contact, placement, message) values (t.id('f'), 'Minha Empresa', 'contato@minha.example', 'sidebar', 'Quero anunciar.');
reset role;
select t.login('g');
select t.ok((select count(*) from public.ad_requests) = 0, 'pedido de anúncio de terceiro é invisível');
reset role;
select t.login('d', 'aal2');
select t.ok((select count(*) from public.ad_requests) = 1, 'financeiro vê pedidos de anúncio');
reset role;
update public.ad_campaigns set ends_at = now() + interval '1 second', starts_at = now() - interval '1 hour' where id = '00000000-0000-0000-0000-00000000ad01';
select pg_sleep(1.1);
select t.ok((select count(*) from public.live_ads('feed_inline')) = 0, 'anúncio vencido sai do ar sozinho');
select public.purge_expired_cache();
select t.ok((select status from public.ad_campaigns where id = '00000000-0000-0000-0000-00000000ad01') = 'ended', 'campanha vencida é encerrada pela rotina diária');
select t.ok((select count(*) from public.audit_logs where entity_type = 'ad_campaigns') >= 3, 'campanhas são auditadas');

-- ------------------------------------------------------------ 0018: conduta, suspensão, anexos, curtidas
-- filtro: o que deve ser barrado
select t.ok(private.moderate_text(x) is not null, 'barra: ' || x) from (values
  ('me chama no whatsapp'), ('meu zap é esse'), ('fala comigo pelo Telegram'), ('segue no insta'), ('w h a t s a p p'),
  ('wh4ts4pp'), ('t.e.l.e.g.r.a.m'), ('11 98765-4321'), ('(11) 98765 4321'), ('+55 11 987654321'), ('fulano@gmail.com'),
  ('fulano arroba hotmail ponto com'), ('@fulano_dev'), ('wa.me/5511987654321'), ('https://instagram.com/fulano'),
  ('vamos fechar por fora'), ('pagamento por fora da plataforma'), ('seu idiota'), ('vai tomar no cu'), ('que merda de serviço')) v(x);
-- filtro: o que NÃO deve ser barrado (texto normal de trabalho)
select t.ok(private.moderate_text(x) is null, 'permite: ' || x) from (values
  ('Preciso de um dashboard em Power BI com 12 páginas até 20/11/2026.'), ('Orçamento de R$ 1.500,00 a R$ 2.500,00, prazo de 10 dias.'),
  ('Integração com o Zapier e instalação do sistema.'), ('O arquivo final está em https://exemplo.dev/entrega/arquivo.pbix'),
  ('Tenho 8 anos de experiência e 120 projetos entregues.'), ('Reunião às 14h30 na segunda-feira.'), ('Planilha com 15000 linhas e 32 colunas.'),
  ('Pinte o gráfico de azul e use a fonte Inter.'), ('Análise de computadores e instalações elétricas.')) v(x);

-- textos públicos são recusados na gravação
select t.login('f');
select t.fails($$update public.freelancer_profiles set bio = 'Me chama no whatsapp 11 98765-4321' where user_id = t.id('f')$$,
               'MODERATION_', 'perfil não aceita contato por fora');
select t.fails($$update public.freelancer_profiles set headline = 'Dev @fulano_dev' where user_id = t.id('f')$$, 'MODERATION_', 'título do perfil não aceita @ de rede social');
select t.fails($$insert into public.portfolio_items (user_id, title, link_url) values (t.id('f'), 'Meu trabalho', 'https://instagram.com/fulano')$$,
               'MODERATION_', 'publicação não aceita link de rede social');
select t.fails($$insert into public.portfolio_items (user_id, title, description) values (t.id('f'), 'Trabalho', 'cliente idiota não pagou')$$,
               'ofensiva', 'publicação não aceita ofensa');
select t.fails($$insert into public.portfolio_items (user_id, title, media) values (t.id('f'), 'Imagem alheia', '[{"path":"00000000-0000-0000-0000-000000000000/abcdef12.png"}]')$$,
               'MEDIA_INVALID', 'publicação só usa imagem da pasta do próprio autor');
insert into public.portfolio_items (user_id, title, description, media)
values (t.id('f'), 'Dashboard de vendas', 'Painel com metas por região.',
        jsonb_build_array(jsonb_build_object('path', t.id('f')::text || '/abcdef12-3456.png')));
select id as post_id from public.portfolio_items where title = 'Dashboard de vendas' \gset
select t.fails($$update public.portfolio_items set likes_count = 999$$, 'permission denied', 'autor não infla as próprias curtidas');
select t.fails(format($$insert into public.post_likes (item_id, user_id) values (%L, t.id('f'))$$, :'post_id'),
               'row-level security', 'autor não curte a própria publicação');
reset role;
select t.login('c');
select t.fails($$insert into public.projects (company_id, created_by, title, description, category_id, status)
                 select '00000000-0000-0000-0000-0000000000c1', t.id('c'), 'Projeto com contato', 'Interessados falem comigo no telegram, por favor.', id, 'open'
                 from public.categories limit 1$$, 'MODERATION_', 'projeto não aceita contato por fora');
insert into public.post_likes (item_id, user_id) values (:'post_id', t.id('c'));
select t.fails(format($$insert into public.post_likes (item_id, user_id) values (%L, t.id('c'))$$, :'post_id'), 'duplicate key', 'uma curtida por pessoa');
reset role;
select t.ok((select likes_count from public.portfolio_items where id = :'post_id') = 1, 'curtida é contada');

-- chat: tempo de resposta, anexos e bloqueio com suspensão
delete from public.user_blocks;
select t.login('c');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_id', t.id('c'), 'Segue a planilha base para começar.');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, attachments) values (%L, t.id('c'), '[{"path":"outra-pasta/x/abcdef12.xlsx","name":"base.xlsx","size":100,"mime":"x"}]')$$, :'conv_id'),
               'ATTACHMENT_INVALID', 'anexo fora da pasta da conversa é recusado');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, attachments) values (%L, t.id('c'), %L)$$, :'conv_id',
               jsonb_build_array(jsonb_build_object('path', :'conv_id' || '/' || t.id('c')::text || '/abcdef12.exe', 'name', 'virus.exe', 'size', 100, 'mime', 'x'))::text),
               'ATTACHMENT_INVALID', 'tipo de arquivo não permitido é recusado');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, attachments) values (%L, t.id('c'), %L)$$, :'conv_id',
               jsonb_build_array(jsonb_build_object('path', :'conv_id' || '/' || t.id('f')::text || '/abcdef12.xlsx', 'name', 'base.xlsx', 'size', 100, 'mime', 'x'))::text),
               'ATTACHMENT_INVALID', 'não anexa arquivo da pasta de outro usuário');
select t.ok(t.affected(format($$insert into public.messages (conversation_id, sender_id, attachments) values (%L, t.id('c'), %L)$$, :'conv_id',
               jsonb_build_array(jsonb_build_object('path', :'conv_id' || '/' || t.id('c')::text || '/abcdef12-3456.xlsx', 'name', 'base de vendas.xlsx', 'size', 20480, 'mime', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))::text)) = 1,
            'planilha válida é anexada pelo chat');
reset role;
update public.messages set created_at = now() - interval '2 hours' where sender_id = t.id('c') and conversation_id = :'conv_id';
select t.login('f');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_id', t.id('f'), 'Recebi, obrigado!');
reset role;
select t.ok((select response_count = 1 and response_seconds between 7000 and 7400 from public.profiles where id = t.id('f')), 'tempo de resposta é medido (cerca de 2 horas)');
select t.login('f');
select t.fails($$update public.profiles set response_seconds = 1, response_count = 99 where id = t.id('f')$$, 'permission denied', 'usuário não altera o próprio tempo de resposta');
select t.fails($$update public.profiles set suspended_until = null where id = t.id('f')$$, 'permission denied', 'usuário não mexe na própria suspensão');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_id', t.id('f'), 'Me passa seu whatsapp que a gente fecha por fora');
select t.ok((select blocked and body like 'Texto recusado%' from public.messages where sender_id = t.id('f') order by id desc limit 1), 'mensagem com contato é bloqueada e substituída por aviso');
reset role;
select t.login('c');
select t.ok(not exists (select 1 from public.messages where blocked), 'a outra parte nunca recebe a mensagem bloqueada');
reset role;
select t.ok((select count(*) from public.moderation_flags where user_id = t.id('f')) = 1, 'ocorrência registrada para a moderação');
select t.login('f');
select t.ok((select count(*) from public.moderation_flags) = 0, 'usuário não lê o registro de ocorrências');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_id', t.id('f'), 'meu numero 11 98765-4321');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_id', t.id('f'), 'me acha no insta entao');
select t.fails(format($$insert into public.messages (conversation_id, sender_id, body) values (%L, t.id('f'), 'oi')$$, :'conv_id'),
               'ACCOUNT_SUSPENDED', 'terceira tentativa em 24h suspende a conta');
select t.fails($$select public.submit_proposal('00000000-0000-0000-0000-00000000aaa2', 15000, 2, 'Proposta de uma conta suspensa aqui.')$$,
               'ACCOUNT_SUSPENDED', 'conta suspensa não envia proposta');
select t.fails($$insert into public.portfolio_items (user_id, title) values (t.id('f'), 'Publicação de conta suspensa')$$, 'ACCOUNT_SUSPENDED', 'conta suspensa não publica');
select t.fails(format($$select public.set_user_suspension(%L, 0, 'Vou me liberar sozinho agora')$$, t.id('f')), 'Acesso negado', 'usuário não retira a própria suspensão');
reset role;
select t.ok((select status from public.contracts where id = :'contract_id') = 'completed', 'suspensão não altera contratos existentes');
insert into public.admin_members (user_id, role) values (t.id('g'), 'moderation');
select t.login('g', 'aal2');
select t.ok((select count(*) from public.moderation_flags where reviewed_at is null) = 3, 'moderação vê as ocorrências com o trecho original');
select t.fails(format($$select public.set_user_suspension(%L, 0, 'curta')$$, t.id('f')), 'justificativa', 'retirar suspensão exige justificativa');
select public.set_user_suspension(t.id('f'), 0, 'Revisado: orientado sobre as regras de conduta.');
reset role;
select t.ok((select suspended_until is null from public.profiles where id = t.id('f')), 'moderação retira a suspensão');
select t.ok((select count(*) from public.audit_logs where entity_type = 'profiles' and action = 'unsuspend') = 1, 'decisão de moderação é auditada');
delete from public.admin_members where user_id = t.id('g');
delete from public.moderation_flags;

-- ------------------------------------------------------------ 0019: só bicos, cupom, vencimentos
select t.login('c');
select t.fails($$insert into public.jobs (company_id, created_by, title, description, category_id, contract_type)
                 select '00000000-0000-0000-0000-0000000000c1', t.id('c'), 'Analista CLT', 'Vaga de emprego não é mais aceita na plataforma.', id, 'clt' from public.categories limit 1$$,
               'permission denied', 'publicação de vagas de emprego está bloqueada');
select t.fails($$select public.redeem_coupon('LANCAMENTO15')$$, 'profissional', 'empresa não usa cupom de profissional');
reset role;
-- cupom de lançamento: 15 dias grátis, guardados até a assinatura ser necessária
delete from public.admin_members where user_id = t.id('a');
select t.login('a');
select t.fails($$select public.redeem_coupon('CHUTE1234')$$, 'COUPON_INVALID', 'código inexistente é recusado sem revelar motivo');
select t.ok((public.redeem_coupon(' lancamento15 ') ->> 'applied_now') = 'false', 'cupom aceito no cadastro fica guardado (ainda no período gratuito)');
select t.fails($$select public.redeem_coupon('LANCAMENTO15')$$, 'COUPON_ALREADY_USED', 'um cupom por profissional');
select t.fails($$update public.freelancer_billing set trial_days_pending = 90$$, 'permission denied', 'usuário não altera os próprios dias grátis');
select t.ok((select count(*) from public.coupons) = 0, 'usuário comum não lista cupons');
reset role;
select t.ok((select redeemed_count from public.coupons where code = 'LANCAMENTO15') = 1, 'uso do cupom é contado');
update public.freelancer_billing set state = 'FIRST_PROJECT_COMPLETED' where user_id = t.id('a'); -- simula a conclusão do primeiro projeto
select t.ok(private.apply_pending_trial(t.id('a')), 'ao concluir o primeiro projeto, os dias do cupom entram em vigor');
select t.ok((select state = 'PRO_ACTIVE' and trial_days_pending = 0 and cycle_end between now() + interval '14 days 23 hours' and now() + interval '15 days 1 hour'
               from public.freelancer_billing where user_id = t.id('a')), 'assinatura ativa por 15 dias, sem cobrança');
select t.ok((select count(*) from public.payments where payer_id = t.id('a')) = 0, 'cupom não gera cobrança');
-- controle de vencimento e renovação antecipada
select t.login('a');
select t.fails($$select public.request_pro('pro', true)$$, '7 dias antes', 'renovação só abre perto do vencimento');
reset role;
update public.freelancer_billing set cycle_end = now() + interval '2 days' where user_id = t.id('a');
select t.ok(public.notify_expiring_subscriptions() = 1, 'aviso de vencimento enviado 3 dias antes');
select t.ok(public.notify_expiring_subscriptions() = 0, 'aviso não se repete no mesmo período');
select t.login('a');
select id as early_pay from public.request_pro('pro', true) \gset
select t.ok((select state from public.freelancer_billing) = 'PRO_ACTIVE', 'pedir a renovação não interrompe o acesso atual');
reset role;
select t.ok(public.process_payment_update(:'early_pay', 'MP-20', 'approved', 'accredited', (select amount_cents from public.payments where id = :'early_pay')) = 'approved', 'renovação antecipada paga');
select t.ok((select cycle_end between now() + interval '31 days' and now() + interval '33 days' from public.freelancer_billing where user_id = t.id('a')),
            'novo período começa quando o atual termina');
select t.login('f');
select t.fails($$select public.notify_expiring_subscriptions()$$, 'permission denied', 'usuário não dispara avisos');
reset role;

-- ------------------------------------------------------------ 0020: taxa só é receita depois da entrega
select t.login('c');
select id as c3 from public.accept_proposal((select id from public.proposals where freelancer_id = t.id('f') and project_id = '00000000-0000-0000-0000-00000000aaa2')) \gset
reset role;
select t.login('f');
select public.confirm_contract(:'c3') \gset y_
reset role;
select id as pay3, amount_cents as pay3_amount from public.payments where contract_id = :'c3' \gset
select t.ok(public.process_payment_update(:'pay3', 'MP-30', 'approved', 'accredited', :'pay3_amount') = 'approved', 'projeto novo pago pelo Mercado Pago');
select t.login('d', 'aal2');
select t.ok((public.admin_metrics(30) ->> 'receita_taxa_servico_centavos')::int = 15000, 'taxa de projeto pago mas ainda em execução NÃO entra como receita');
select t.ok((public.admin_metrics(30) ->> 'taxa_a_reconhecer_centavos')::int = 1500, 'ela fica separada como taxa a reconhecer (pode voltar se o projeto for cancelado)');
reset role;
select t.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and (column_name ~ '(card|cartao|cvv|cvc|expir_month|security_code)' or column_name in ('pan', 'pix_key'))),
            'nenhuma coluna guarda dado de cartão ou chave Pix');

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
