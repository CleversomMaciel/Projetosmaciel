// Fluxo completo pelo navegador, contra o ambiente local (ver run.sh).
const { chromium, devices } = require('playwright');

const { APP_URL, GW_URL, ANON_KEY, OUT } = process.env;
// E2E_DEMO=1 gera capturas de tela "limpas" (sem a carga de ataque nos textos)
const XSS = process.env.E2E_DEMO ? '' : '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
const stamp = Date.now();
const company = { name: 'Carla Contratante', email: `empresa${stamp}@teste.dev`, pass: 'senha-forte-123' };
const freela = { name: 'Fran Freela', email: `freela${stamp}@teste.dev`, pass: 'senha-forte-123' };
const intruder = { name: 'Ivo Intruso', email: `intruso${stamp}@teste.dev`, pass: 'senha-forte-123' };
const admin = { name: 'Ada Admin', email: `admin${stamp}@teste.dev`, pass: 'senha-forte-123' };
const results = []; const problems = []; const httpErrors = []; const pages = []; let attacking = false;

async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push(`ok   ${name} (${Date.now() - t}ms)`); console.log(`ok   ${name}`); }
  catch (err) { await Promise.all(pages.map((p, i) => p.screenshot({ path: `${OUT}/falha-${i}.png`, fullPage: true }).catch(() => {}))); console.log('últimas respostas com erro:\n  ' + httpErrors.slice(-4).join('\n  ')); console.log(`FALHOU ${name}\n  ${String(err.message).split('\n').slice(0, 6).join('\n  ')}`); throw err; }
}
const assert = (cond, msg) => { if (!cond) throw new Error(`verificação falhou: ${msg}`); };
const see = (page, text, timeout = 8000) => page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });

async function newUser(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, locale: 'pt-BR', ...opts });
  const page = await ctx.newPage(); pages.push(page);
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => problems.push(`pageerror ${page.url()}: ${e.message}`));
  page.on('response', async (r) => { if (r.status() >= 300 && r.status() !== 304 && /\/rest\/v1|\/api\//.test(r.url())) httpErrors.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 220)} ${(await r.text().catch(() => '')).slice(0, 300)}`); });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (attacking) return; // o passo do invasor provoca erros de propósito e os verifica um a um
    if (/WebSocket|realtime|ERR_CONNECTION|404 \(Not Found\)|status of 40[0-9]/.test(text)) return; // sem servidor de tempo real no teste; 4xx esperados são verificados nos passos
    problems.push(`console ${page.url()}: ${text}`);
  });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const pwned = (page) => page.evaluate(() => window.__pwned);

async function signup(page, who, tipo) {
  await page.goto(`${APP_URL}/cadastro?tipo=${tipo}`);
  await page.fill('#nome', who.name); await page.fill('#email', who.email); await page.fill('#senha', who.pass);
  await page.click('#form button[type=submit]');
  await page.waitForURL('**/onboarding');
}
async function onboardFreelancer(page, headline) {
  await page.waitForSelector('#form-freelancer:not([hidden])');
  await page.fill('#headline', headline);
  await page.fill('#f-cep', '01001000');
  await page.waitForFunction(() => document.querySelector('#f-street').value.length > 0);
  await page.fill('#f-number', '10');
  await page.check('#f-confirma-endereco');
  await page.check('#form-freelancer [data-aceite]');
  await page.click('#form-freelancer button[type=submit]');
  await page.waitForURL('**/painel');
}

(async () => {
  const browser = await chromium.launch();
  const c = await newUser(browser); const f = await newUser(browser);
  let projectUrl; let contractUrl; let slug;

  await step('página inicial lista as 11 categorias do banco', async () => {
    await c.page.goto(APP_URL);
    await c.page.waitForFunction(() => document.querySelectorAll('#categorias a').length === 11);
    await shot(c.page, '01-inicio');
  });

  await step('empresa: cadastro + onboarding com CNPJ e CEP automáticos', async () => {
    await signup(c.page, company, 'company');
    await c.page.waitForSelector('#form-empresa:not([hidden])');
    await c.page.fill('#cnpj', '11.222.333/0001-81');
    await c.page.click('#buscar-cnpj');
    await c.page.waitForSelector('#cnpj-dados:not([hidden])');
    assert((await c.page.inputValue('#displayName')) === 'Acme Tech', 'nome fantasia preenchido pelo CNPJ');
    assert(!(await c.page.content()).includes('SOCIO QUE NAO DEVE APARECER'), 'dados de sócio não chegam ao navegador');
    await c.page.waitForFunction(() => document.querySelector('#street').value === 'Praça da Sé');
    await c.page.fill('#number', '1000');
    await shot(c.page, '02-onboarding-empresa');
    await c.page.check('#confirma-endereco');
    await c.page.check('#form-empresa [data-aceite]');
    await c.page.click('#form-empresa button[type=submit]');
    await c.page.waitForURL('**/painel');
    await see(c.page, 'Olá, Carla');
  });

  await step('empresa: publica projeto (com tentativa de XSS no texto)', async () => {
    await c.page.goto(`${APP_URL}/publicar-projeto`);
    await c.page.waitForSelector('#form:not([hidden])');
    await c.page.fill('#title', `Dashboard de vendas em Power BI ${XSS}`.slice(0, 140));
    await c.page.fill('#description', `Preciso de um dashboard com metas e filtros por região. ${XSS}`);
    await c.page.fill('#deliverables', 'Arquivo .pbix e uma reunião de repasse.');
    await c.page.selectOption('#category', { index: 2 });
    await c.page.fill('#min', '1.500'); await c.page.fill('#max', '2.500'); await c.page.fill('#deadline', '10');
    await c.page.click('button[data-status="open"]');
    await c.page.waitForURL('**/projeto?id=*');
    projectUrl = c.page.url();
    await see(c.page, 'Propostas recebidas');
    assert(!(await pwned(c.page)), 'XSS não executa na página do projeto');
  });

  await step('profissional: cadastro, onboarding e estado inicial de propostas ilimitadas', async () => {
    await signup(f.page, freela, 'freelancer');
    await onboardFreelancer(f.page, 'Analista de dados · Power BI e SQL');
    await see(f.page, 'Propostas ilimitadas');
  });

  await step('profissional: encontra o projeto na busca e envia proposta', async () => {
    await f.page.goto(`${APP_URL}/projetos?q=dashboard`);
    await f.page.waitForSelector('#lista .xcard');
    assert(!(await pwned(f.page)), 'XSS não executa na listagem');
    assert(await f.page.locator('#lista .xcard-panel').first().evaluate((el) => el.hasAttribute('inert')), 'card fechado fica fora da navegação por teclado');
    await f.page.click('#lista .xcard-head');
    await f.page.waitForSelector('#lista .xcard[data-open] [name=valor]');
    await f.page.waitForTimeout(400);
    await shot(f.page, '03-projetos');
    await f.page.fill('#lista [name=valor]', '2.000'); await f.page.fill('#lista [name=prazo]', '7');
    await f.page.fill('#lista [name=carta]', `Tenho experiência com Power BI e modelagem de dados. ${XSS}`);
    await f.page.click('#lista [data-proposal] button[type=submit]');
    await see(f.page, 'Proposta enviada');
  });

  await step('chat: profissional abre conversa e envia mensagem', async () => {
    await f.page.click('#lista [data-chat]');
    await f.page.waitForURL('**/mensagens?c=*');
    await f.page.waitForSelector('#enviar:not([hidden])');
    await f.page.fill('#texto', `Olá! Posso começar na segunda. ${XSS}`);
    await f.page.click('#enviar button');
    await f.page.waitForSelector('#thread [data-id]');
    assert(!(await pwned(f.page)), 'XSS não executa no chat');
  });

  await step('empresa: vê a proposta, responde no chat e aceita', async () => {
    await c.page.goto(projectUrl);
    await see(c.page, 'Fran Freela');
    assert(!(await pwned(c.page)), 'XSS da proposta não executa para a empresa');
    await c.page.click('[data-chat]');
    await c.page.waitForURL('**/mensagens?c=*');
    await see(c.page, 'Posso começar na segunda');
    await c.page.fill('#texto', 'Perfeito, vou aceitar a proposta.');
    await c.page.click('#enviar button');
    await c.page.waitForFunction(() => document.querySelectorAll('#thread [data-id]').length === 2);
    assert(!(await pwned(c.page)), 'XSS do chat não executa para a empresa');
    await shot(c.page, '04-mensagens');
    await c.page.goto(projectUrl);
    await c.page.click('[data-accept]');
    await c.page.waitForURL('**/contrato?id=*');
    contractUrl = c.page.url();
    await see(c.page, 'Aguardando confirmação do profissional');
    await see(c.page, 'R$ 200,00'); // taxa de serviço = 10% de R$ 2.000
    await see(c.page, 'R$ 1.800,00');
  });

  await step('profissional: confirma o contrato pelo painel', async () => {
    await f.page.goto(`${APP_URL}/painel`);
    await f.page.click('a[href^="/contrato?id="]');
    await f.page.click('[data-action="confirm_contract"]');
    await see(f.page, 'Aguardando a empresa pagar a taxa de serviço');
  });

  await step('empresa: paga a taxa de serviço (checkout -> webhook assinado -> contrato ativo)', async () => {
    await c.page.goto(contractUrl);
    await c.page.click('[data-action="pay"]');
    await c.page.waitForURL('**/contrato?id=*');
    await see(c.page, 'Em execução');
    await see(c.page, 'Taxa de serviço confirmada');
  });

  await step('profissional: registra entrega; empresa aprova, declara saldo e avalia', async () => {
    await f.page.goto(contractUrl);
    await see(f.page, 'Primeiro bico');
    await f.page.fill('#n-deliver_contract', 'Dashboard publicado, link e arquivo enviados por mensagem.');
    await f.page.click('[data-form="deliver_contract"] button');
    await see(f.page, 'Entrega enviada');
    await c.page.goto(contractUrl);
    await c.page.click('[data-action="approve_delivery"]');
    await see(c.page, 'Concluído');
    await c.page.click('[data-action="declare_balance_paid"]');
    await see(c.page, 'Aguardando o profissional confirmar o recebimento');
    await c.page.fill('#comentario', 'Entrega excelente, no prazo.');
    await c.page.click('[data-form="review"] button');
    await see(c.page, 'Você avaliou com nota 5');
    await shot(c.page, '05-contrato-concluido');
  });

  await step('profissional: confirma saldo; painel oferece o Pro; nova proposta exige plano', async () => {
    await f.page.goto(contractUrl);
    await f.page.click('[data-action="confirm_balance_received"]');
    await see(f.page, 'recebimento confirmado');
    await f.page.goto(`${APP_URL}/painel`);
    await see(f.page, 'Primeiro bico concluído');
    await shot(f.page, '06-painel-profissional');
  });

  await step('profissional: compra o plano Pro com aceite expresso (pagamento único)', async () => {
    await f.page.goto(`${APP_URL}/plano`);
    await see(f.page, 'R$ 29,90');
    await f.page.click('[data-plan="pro"]');
    await f.page.click('#compra button[type=submit]'); // sem marcar o aceite
    await see(f.page, 'Marque a autorização');
    await shot(f.page, '07-plano');
    await f.page.check('#aceite');
    await f.page.click('#compra button[type=submit]');
    await f.page.waitForURL('**/plano');
    await see(f.page, 'ativo até');
    await see(f.page, '0 de 10 propostas');
  });

  await step('profissional: perfil público e portfólio; visitante anônimo enxerga', async () => {
    await f.page.goto(`${APP_URL}/perfil`);
    await f.page.waitForSelector('#form:not([hidden])');
    slug = `fran-dados-${stamp}`;
    await f.page.fill('#slug', slug); await f.page.fill('#tools', 'Power BI, SQL, Excel');
    await f.page.fill('#bio', `Transformo planilhas em painéis. ${XSS}`);
    await f.page.check('#publico');
    await f.page.click('#form button[type=submit]');
    await see(f.page, 'Perfil salvo');
    await f.page.fill('#pt', 'Painel financeiro para varejo'); await f.page.fill('#pd', 'Reduziu o fechamento mensal de 5 para 2 dias.');
    await f.page.click('#novo-item button');
    await see(f.page, 'Trabalho externo');
    const anon = await newUser(browser);
    const res = await anon.page.goto(`${APP_URL}/profissional?u=${slug}`);
    const html = await res.text();
    assert(html.includes('<title>Fran Freela'), 'título pré-renderizado no servidor');
    assert(!html.includes('<script>window.__pwned'), 'XSS escapado no HTML do servidor');
    if (XSS) assert(html.includes('&lt;script&gt;window.__pwned'), 'a carga de ataque chegou ao servidor e foi neutralizada');
    await see(anon.page, 'Painel financeiro para varejo');
    await see(anon.page, 'Nota 5.0');
    await see(anon.page, '1 projeto(s) concluído(s)');
    assert(!(await pwned(anon.page)), 'XSS não executa no perfil público');
    await shot(anon.page, '08-perfil-publico');
    await anon.ctx.close();
  });

  await step('vagas: empresa publica vaga remota; profissional se candidata', async () => {
    await c.page.goto(`${APP_URL}/publicar-vaga`);
    await c.page.waitForSelector('#form:not([hidden])');
    await c.page.fill('#title', 'Analista de BI pleno');
    await c.page.selectOption('#category', { index: 2 });
    await c.page.fill('#description', 'Atuar na construção de indicadores e painéis para a diretoria.');
    await c.page.fill('#smin', '6.000'); await c.page.fill('#smax', '8.000');
    await c.page.click('#form button[type=submit]');
    await c.page.waitForURL('**/vagas');
    await see(c.page, 'Analista de BI pleno');
    await f.page.goto(`${APP_URL}/vagas`);
    await f.page.click('#lista .xcard-head');
    await f.page.fill('#lista [name=carta]', 'Tenho três anos de experiência com indicadores.');
    await f.page.waitForTimeout(400);
    await shot(f.page, '12-vagas');
    await f.page.click('#lista [data-apply] button[type=submit]');
    await see(f.page, 'Candidatura enviada');
    await f.page.reload();
    await f.page.click('#lista .xcard-head');
    await see(f.page, 'Candidatura enviada');
  });

  await step('anúncios: profissional pede para anunciar pelo site', async () => {
    await f.page.goto(`${APP_URL}/anuncie`);
    await f.page.fill('#empresa', 'Acme Cursos'); await f.page.fill('#contato', 'comercial@acme.example');
    await f.page.selectOption('#formato', 'sidebar');
    await f.page.click('#form button[type=submit]');
    await see(f.page, 'Pedido recebido');
  });

  await step('invasor: API recusa leitura e escrita fora das permissões', async () => {
    const i = await newUser(browser);
    await signup(i.page, intruder, 'freelancer');
    await onboardFreelancer(i.page, 'Curioso');
    attacking = true;
    const out = await i.page.evaluate(async ({ gw, anon, contractUrl }) => {
      const session = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('auth-token'))[1]);
      const h = { apikey: anon, authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json', prefer: 'return=representation' };
      const get = async (path, headers = h) => { const r = await fetch(`${gw}/rest/v1/${path}`, { headers }); return { status: r.status, body: await r.json().catch(() => null) }; };
      const send = async (method, path, body) => { const r = await fetch(`${gw}/rest/v1/${path}`, { method, headers: h, body: JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
      const contractId = new URL(contractUrl).searchParams.get('id');
      return {
        contratos: await get('contracts?select=id'),
        propostas: await get('proposals?select=id'),
        mensagens: await get('messages?select=id'),
        privados: await get('profile_private?select=user_id'),
        empresaPrivada: await get('company_private?select=cnpj'),
        pagamentos: await get('payments?select=id'),
        webhook: await get('webhook_events?select=id'),
        anonPrivado: await get('profile_private?select=user_id', { apikey: anon, authorization: `Bearer ${anon}` }),
        virarPro: await send('PATCH', `freelancer_billing?user_id=eq.${session.user.id}`, { state: 'PRO_ACTIVE' }),
        virarAdmin: await send('POST', 'admin_members', { user_id: session.user.id, role: 'super_admin' }),
        inflarNota: await send('PATCH', `freelancer_profiles?user_id=eq.${session.user.id}`, { rating_avg: 5, completed_projects: 99 }),
        aprovarPagamento: await send('POST', 'rpc/process_payment_update', { p_payment_id: contractId, p_provider_payment_id: 'x', p_provider_status: 'approved', p_status_detail: null, p_amount_cents: 1 }),
        aprovarEntregaAlheia: await send('POST', 'rpc/approve_delivery', { p_contract_id: contractId }),
        metricas: await send('POST', 'rpc/admin_metrics', { p_days: 30 }),
        checkoutAlheio: await fetch(`/api/payments/${contractId}/checkout`, { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: '{}' }).then((r) => r.status),
      };
    }, { gw: GW_URL, anon: ANON_KEY, contractUrl });
    assert(out.contratos.body.length === 0, 'não vê contratos alheios');
    assert(out.propostas.body.length === 0, 'não vê propostas alheias');
    assert(out.mensagens.body.length === 0, 'não vê mensagens alheias');
    assert(out.privados.body.length === 1, 'vê só os próprios dados privados');
    assert(out.empresaPrivada.body.length === 0, 'não vê CNPJ/dados fiscais de empresa');
    assert(out.pagamentos.body.length === 0, 'não vê pagamentos alheios');
    assert([401, 403].includes(out.webhook.status), `webhook_events negado (${out.webhook.status})`);
    assert([401, 403].includes(out.anonPrivado.status), `anônimo sem acesso a dados privados (${out.anonPrivado.status})`);
    assert([401, 403].includes(out.virarPro.status), `não altera a própria assinatura (${out.virarPro.status})`);
    assert([401, 403].includes(out.virarAdmin.status), `não se promove a admin (${out.virarAdmin.status})`);
    assert([401, 403].includes(out.inflarNota.status), `não altera a própria nota (${out.inflarNota.status})`);
    assert([401, 403, 404].includes(out.aprovarPagamento.status), `não aprova pagamento (${out.aprovarPagamento.status})`);
    assert(out.aprovarEntregaAlheia.status >= 400, 'não aprova entrega de contrato alheio');
    assert(out.metricas.status >= 400, 'não lê indicadores administrativos');
    assert(out.checkoutAlheio === 404, `não inicia checkout alheio (${out.checkoutAlheio})`);
    await i.page.goto(contractUrl);
    await see(i.page, 'Contrato não encontrado');
    await i.page.goto(`${APP_URL}/admin`);
    await see(i.page, 'Acesso restrito');
    await i.ctx.close();
    attacking = false;
  });

  await step('administração (com 2º fator): indicadores separam GMV de receita', async () => {
    const a = await newUser(browser);
    await signup(a.page, admin, 'freelancer');
    await fetch(`${GW_URL}/fake/make-admin?email=${encodeURIComponent(admin.email)}&role=super_admin`);
    await a.page.evaluate(() => localStorage.clear());
    await a.page.goto(`${APP_URL}/entrar?next=/admin`);
    await a.page.fill('#email', admin.email); await a.page.fill('#senha', admin.pass);
    await a.page.click('#form button[type=submit]');
    await a.page.waitForURL('**/admin');
    await a.page.waitForSelector('#indicadores');
    const text = await a.page.locator('#indicadores').innerText();
    assert(/GMV[^\n]*\n\s*R\$\s?2\.000,00/.test(text), `GMV de R$ 2.000 (${text.slice(0, 200)})`);
    assert(/taxa de serviço\s*\n\s*R\$\s?200,00/.test(text), 'receita de taxa de serviço R$ 200');
    assert(/assinaturas\s*\n\s*R\$\s?29,90/.test(text), 'receita de assinaturas R$ 29,90');
    await a.page.waitForSelector('#planos'); await a.page.waitForSelector('#categorias');
    await see(a.page, 'Pedidos de anúncio aguardando contato');
    await a.page.fill('#ad-anunciante', 'Acme Cursos'); await a.page.selectOption('#ad-local', 'sidebar');
    await a.page.fill('#ad-titulo', `Formação em Power BI ${XSS}`.slice(0, 70)); await a.page.fill('#ad-texto', 'Turmas noturnas, 100% online.');
    await a.page.fill('#ad-url', 'https://acme.example/curso'); await a.page.fill('#ad-preco', '1.500');
    await a.page.click('#novo-anuncio button[type=submit]');
    await a.page.waitForSelector('[data-ad-status="active"]');
    const before = await newUser(browser);
    await before.page.goto(`${APP_URL}/projetos`, { waitUntil: 'networkidle' });
    assert(!(await before.page.content()).includes('Formação em Power BI'), 'rascunho de anúncio não aparece para o público');
    await a.page.click('[data-ad-status="active"]');
    await a.page.waitForSelector('[data-ad-status="paused"]');
    await shot(a.page, '09-admin');
    await before.page.reload({ waitUntil: 'networkidle' });
    await see(before.page, 'Formação em Power BI');
    await see(before.page, 'Patrocinado');
    assert(!(await pwned(before.page)), 'XSS não executa no anúncio');
    const rel = await before.page.locator('#ad-lateral a.ad').getAttribute('rel');
    assert(/sponsored/.test(rel) && /noopener/.test(rel), 'link de anúncio marcado como patrocinado e isolado');
    await shot(before.page, '13-projetos-com-anuncio');
    await before.ctx.close();
    await a.ctx.close();
  });

  await step('celular: páginas principais sem rolagem horizontal', async () => {
    const m = await newUser(browser, { ...devices['iPhone 13'] });
    for (const path of ['/', '/projetos', '/vagas', `/profissional?u=${slug}`]) {
      await m.page.goto(APP_URL + path, { waitUntil: 'networkidle' });
      const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `${path} com rolagem horizontal de ${overflow}px`);
    }
    await shot(m.page, '10-celular-perfil');
    await m.ctx.close();
  });

  await step('painel da empresa mostra projeto e contrato', async () => {
    await c.page.goto(`${APP_URL}/painel`);
    await c.page.waitForSelector('#blocos section');
    await see(c.page, 'Concluído');
    await shot(c.page, '11-painel-empresa');
  });

  await browser.close();
  console.log(`\n${results.length} passos concluídos.`);
  if (problems.length) { console.log('ERROS DE NAVEGADOR:\n' + [...new Set(problems)].join('\n')); process.exit(1); }
})().catch((err) => { if (!/locator|Timeout|verificação/.test(String(err && err.message))) console.error(err); process.exit(1); });
