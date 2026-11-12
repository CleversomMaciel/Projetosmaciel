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

async function signup(page, who, tipo, coupon = null) {
  await page.goto(`${APP_URL}/cadastro?tipo=${tipo}`);
  if (coupon) await page.fill('#cupom', coupon);
  await page.fill('#nome', who.name); await page.fill('#email', who.email); await page.fill('#senha', who.pass);
  await page.click('#form button[type=submit]');
  await page.waitForURL('**/onboarding');
}
async function onboardFreelancer(page, headline) {
  await page.waitForSelector('#form-freelancer:not([hidden])');
  assert((await page.locator('#form-freelancer input[autocomplete="postal-code"]').count()) === 0, 'cadastro do profissional não pede endereço');
  await page.fill('#headline', headline);
  await page.waitForSelector('#ob-habilidades [data-skill]');
  await page.check('#form-freelancer [data-aceite]');
  await page.click('#form-freelancer button[type=submit]');
  await page.waitForURL('**/painel*');
}
// arte de exemplo gerada no próprio teste
async function makeArt(browser, w, h, html) {
  const p = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.setContent(`<body style="margin:0;display:grid;place-items:center;height:100vh;font-family:sans-serif;color:#fff;text-align:center;${html[0]}">${html[1]}</body>`);
  const buf = await p.screenshot({ type: 'png' });
  await p.context().close();
  return buf;
}

(async () => {
  const browser = await chromium.launch();
  const c = await newUser(browser); const f = await newUser(browser);
  let projectUrl; let contractUrl; let slug;

  await step('página inicial: só tecnologia, sem vagas de emprego', async () => {
    await c.page.goto(APP_URL);
    await c.page.waitForFunction(() => document.querySelectorAll('#categorias a').length >= 10);
    assert((await c.page.locator('a[href="/vagas"]').count()) === 0, 'não há link para vagas de emprego');
    const moved = await c.page.request.get(`${APP_URL}/vagas`, { maxRedirects: 0 });
    assert(moved.status() === 301, 'endereço antigo de vagas redireciona');
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
    await c.page.fill('#deliverables', 'Arquivo .pbix do dashboard\nReunião de repasse de 1 hora');
    await c.page.fill('#habilidades input', 'power');
    await c.page.locator('#habilidades [data-skill]', { hasText: /^Power\ BI$/ }).click();
    await c.page.selectOption('#category', { index: 2 });
    await c.page.fill('#min', '1.500'); await c.page.fill('#max', '2.500'); await c.page.fill('#deadline', '10');
    await c.page.click('button[data-status="open"]');
    await c.page.waitForURL('**/projeto?id=*');
    projectUrl = c.page.url();
    await see(c.page, 'Propostas recebidas');
    assert(!(await pwned(c.page)), 'XSS não executa na página do projeto');
  });

  await step('profissional: cadastro, onboarding e estado inicial de propostas ilimitadas', async () => {
    await signup(f.page, freela, 'freelancer', 'lancamento15');
    await onboardFreelancer(f.page, 'Analista de dados · Power BI e SQL');
    await see(f.page, 'Cupom aplicado: 15 dias');
    await see(f.page, 'Propostas ilimitadas');
  });

  await step('profissional: habilidades no perfil e conexão da conta Mercado Pago', async () => {
    await f.page.goto(`${APP_URL}/perfil`);
    await f.page.waitForSelector('#habilidades [data-skill]');
    await f.page.fill('#habilidades input', 'power');
    await f.page.locator('#habilidades [data-skill]', { hasText: /^Power\ BI$/ }).click();
    await f.page.fill('#habilidades input', 'sql');
    await f.page.locator('#habilidades [data-skill]', { hasText: /^SQL$/ }).click();
    await f.page.fill('#bio', 'Me chama no whatsapp 11 98765-4321 que respondo rápido');
    await f.page.click('#form button[type=submit]');
    await see(f.page, 'Texto recusado');
    await f.page.fill('#bio', 'Transformo planilhas em painéis claros para a diretoria.');
    await f.page.click('#form button[type=submit]');
    await see(f.page, 'Perfil salvo');
    await f.page.reload();
    await f.page.waitForSelector('#habilidades [data-skill][aria-pressed="true"]');
    assert((await f.page.locator('#habilidades [data-skill][aria-pressed="true"]').count()) === 2, 'habilidades ficam salvas');
    assert((await f.page.locator('#pix').count()) === 0, 'não pedimos chave Pix nem dados bancários');
    await f.page.click('#mp-conectar'); // vai ao Mercado Pago (simulado) e volta com a autorização
    await f.page.waitForURL('**/perfil?mp=ok');
    await see(f.page, 'Conta do Mercado Pago conectada');
  });

  await step('profissional: encontra o projeto na busca e envia proposta', async () => {
    await f.page.goto(`${APP_URL}/projetos?q=dashboard`);
    await f.page.waitForSelector('#lista .xcard');
    assert(!(await pwned(f.page)), 'XSS não executa na listagem');
    await see(f.page, 'Combina com 1 habilidade sua');
    await f.page.check('#para-mim');
    await f.page.waitForSelector('#lista .xcard');
    assert((await f.page.locator('#lista .xcard').count()) === 1, 'filtro por minhas habilidades mantém o projeto que combina');
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
    // arquivo disfarçado (executável renomeado para .xlsx) é recusado antes de subir
    await c.page.setInputFiles('#arquivo', { name: 'planilha.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('MZ\x90\x00executavel disfarcado') });
    await see(c.page, 'não é um tipo de arquivo aceito');
    // planilha de verdade (assinatura ZIP do .xlsx) segue pelo chat
    await c.page.setInputFiles('#arquivo', { name: 'base de vendas.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(2048, 7)]) });
    await c.page.fill('#texto', 'Perfeito, vou aceitar a proposta. Segue a base para você começar.');
    await c.page.click('#enviar button');
    await c.page.waitForFunction(() => document.querySelectorAll('#thread [data-id]').length === 2);
    await see(c.page, 'base de vendas.xlsx');
    // tentativa de levar para fora: a mensagem não é entregue
    await c.page.fill('#texto', 'Me chama no whatsapp 11 98765-4321 que é mais rápido');
    await c.page.click('#enviar button');
    await see(c.page, 'Mensagem não enviada');
    await shot(c.page, '04-mensagens');
    await f.page.reload();
    await f.page.waitForSelector('#thread [data-file]');
    assert(!(await f.page.content()).includes('98765'), 'a outra parte nunca recebe o contato bloqueado');
    assert((await f.page.locator('#thread [data-id]').count()) === 2, 'mensagem bloqueada não aparece para o destinatário');
    const [download] = await Promise.all([f.page.waitForEvent('download'), f.page.click('#thread [data-file]')]);
    assert((await download.suggestedFilename()).endsWith('.xlsx'), 'profissional baixa a planilha pelo chat');
    await f.page.fill('#texto', 'Recebi a planilha, obrigado!');
    await f.page.click('#enviar button');
    await f.page.waitForFunction(() => document.querySelectorAll('#thread [data-id]').length === 3);
    assert(!(await pwned(c.page)), 'XSS do chat não executa para a empresa');
    await c.page.goto(projectUrl);
    await c.page.click('[data-accept]');
    await c.page.waitForURL('**/contrato?id=*');
    contractUrl = c.page.url();
    await see(c.page, 'Aguardando confirmação do profissional');
    await see(c.page, 'R$ 200,00'); // taxa de serviço = 10% por cima
    await see(c.page, 'R$ 2.200,00'); // total pago pela empresa
    assert((await c.page.locator('#itens [data-item]').count()) === 2, 'cada linha de entregável virou um item do contrato');
  });

  await step('profissional: confirma o contrato pelo painel', async () => {
    await f.page.goto(`${APP_URL}/painel`);
    await f.page.click('a[href^="/contrato?id="]');
    await f.page.click('[data-action="confirm_contract"]');
    await see(f.page, 'Aguardando o pagamento da empresa');
  });

  await step('empresa paga pelo Mercado Pago: pagamento dividido, direto para a conta do profissional', async () => {
    await c.page.goto(contractUrl);
    await c.page.click('[data-action="pay"]');
    await c.page.waitForURL('**/contrato?id=*');
    await see(c.page, 'Em execução');
    await see(c.page, 'Pagamento confirmado');
    await see(c.page, 'Pagamento ao profissional: R$ 2.000,00');
    const pref = await (await fetch(`${GW_URL}/fake/mp/last-preference`)).json();
    assert(pref.token === 'profissional', 'cobrança criada na conta Mercado Pago do profissional (a plataforma não recebe a parte dele)');
    assert(pref.unit_price === 2200 && pref.marketplace_fee === 200, `empresa paga R$ 2.200 e o Mercado Pago separa R$ 200 de taxa (${JSON.stringify(pref)})`);
  });

  await step('entrega dentro do app: item a item; empresa pede ajuste em um item', async () => {
    await f.page.goto(contractUrl);
    await see(f.page, 'Primeiro bico');
    await see(f.page, 'Pagamento ao profissional');
    // tentar entregar sem preencher os itens é barrado
    await f.page.fill('#n-deliver_contract', 'Dashboard publicado e reunião realizada.');
    await f.page.click('[data-form="deliver_contract"] button');
    await see(f.page, 'Descreva o que foi feito em cada item');
    const notes = f.page.locator('#itens [data-note]'); const urls = f.page.locator('#itens [data-url]');
    await notes.nth(0).fill('Arquivo final com as 4 páginas do dashboard.'); await urls.nth(0).fill('https://exemplo.dev/dashboard.pbix');
    await notes.nth(1).fill(`Reunião feita em 12/11 com a equipe. ${XSS}`);
    await f.page.click('[data-form="deliver_contract"] button');
    await see(f.page, 'Entrega enviada');

    await c.page.goto(contractUrl);
    assert(!(await pwned(c.page)), 'XSS da entrega não executa para a empresa');
    await see(c.page, 'https://exemplo.dev/dashboard.pbix');
    await c.page.locator('[data-change]').nth(1).check();
    await c.page.fill('#n-request_changes', 'Faltou enviar a gravação da reunião de repasse.');
    await c.page.click('[data-form="request_changes"] button');
    await see(c.page, 'Em execução');
    await see(c.page, 'Ajuste pedido');

    await f.page.goto(contractUrl);
    await see(f.page, 'Faltou enviar a gravação');
    assert((await f.page.locator('#itens [data-note]').count()) === 1, 'só o item com ajuste volta para o profissional');
    await f.page.locator('#itens [data-note]').fill('Gravação da reunião anexada.'); await f.page.locator('#itens [data-url]').fill('https://exemplo.dev/gravacao');
    await f.page.fill('#n-deliver_contract', 'Ajuste feito: gravação da reunião incluída.');
    await f.page.click('[data-form="deliver_contract"] button');
    await see(f.page, 'Entrega enviada');
  });

  await step('empresa valida a entrega: projeto concluído; cupom de 15 dias entra em vigor', async () => {
    await c.page.goto(contractUrl);
    await c.page.click('[data-action="approve_delivery"]');
    await see(c.page, 'Concluído');
    await c.page.fill('#comentario', 'Entrega excelente, no prazo.');
    await c.page.click('[data-form="review"] button');
    await see(c.page, 'Você avaliou com nota 5');
    await shot(c.page, '05-contrato-concluido');
    await f.page.goto(`${APP_URL}/painel`);
    await see(f.page, 'Bico BR Pro ativo'); // sem cupom seria "Primeiro bico concluído" pedindo assinatura
    await see(f.page, 'propostas e projetos ilimitados');
    await see(f.page, 'Pago na sua conta Mercado Pago');
    await shot(f.page, '06-painel-profissional');
  });

  await step('reclamação após a conclusão: aberta pelo suporte, com protocolo', async () => {
    await c.page.goto(`${APP_URL}/suporte`);
    await c.page.click('#contratos a:has-text("Abrir reclamação")');
    await c.page.waitForSelector('#reclamar[open]');
    await c.page.selectOption('#motivo', 'entrega_fora_do_escopo');
    await c.page.fill('#n-open_dispute', 'Uma das páginas do dashboard veio sem o filtro por região.');
    await c.page.click('[data-form="open_dispute"] button');
    await see(c.page, 'Reclamação BICO-');
    await shot(c.page, '15-reclamacao');
    await f.page.goto(contractUrl);
    await f.page.fill('#n-dispute_entry', 'O filtro por região está na página 2, como combinado no escopo.');
    await f.page.click('[data-form="dispute_entry"] button');
    await see(f.page, 'O filtro por região está na página 2');
  });

  await step('assinatura: 15 dias do cupom em vigor, sem cobrança, com vencimento visível', async () => {
    await f.page.goto(`${APP_URL}/plano`);
    await see(f.page, 'Assinatura ativa até');
    await see(f.page, '(15 dias)');
    await see(f.page, 'R$ 25,00');
    assert((await f.page.locator('[data-plan]').count()) === 0, 'renovação só abre 7 dias antes do vencimento');
    assert(await f.page.locator('#cupom').isHidden(), 'cupom já usado não pode ser usado de novo');
    await shot(f.page, '07-plano');
  });

  await step('profissional: perfil público e portfólio; visitante anônimo enxerga', async () => {
    await f.page.goto(`${APP_URL}/perfil`);
    await f.page.waitForSelector('#form:not([hidden])');
    slug = `fran-dados-${stamp}`;
    await f.page.fill('#slug', slug); await f.page.fill('#tools', 'Power BI, SQL, Excel'); await f.page.fill('#headline', 'Analista de dados · Power BI e SQL');
    await f.page.fill('#bio', `Transformo planilhas em painéis. ${XSS}`);
    await f.page.check('#publico');
    await f.page.click('#form button[type=submit]');
    await see(f.page, 'Perfil salvo');
    const art = await makeArt(browser, 1200, 750, ['background:linear-gradient(135deg,#0b8a56,#062c1e)', '<div><div style="font-size:30px;opacity:.8">PAINEL FINANCEIRO</div><div style="font-size:120px;font-weight:800">R$ 4,2 mi</div><div style="font-size:34px">receita no trimestre · +18%</div></div>']);
    await f.page.fill('#pt', 'Painel financeiro para varejo'); await f.page.fill('#pd', 'meu insta é @fran_dados');
    await f.page.click('#novo-item button');
    await see(f.page, 'Texto recusado');
    await f.page.fill('#pd', 'Reduziu o fechamento mensal de 5 para 2 dias.');
    await f.page.setInputFiles('#pi', { name: 'painel.png', mimeType: 'image/png', buffer: art });
    await f.page.click('#novo-item button');
    await f.page.waitForSelector('#itens [data-post] img');
    await see(f.page, 'Trabalho informado pelo profissional');
    const anon = await newUser(browser);
    const res = await anon.page.goto(`${APP_URL}/profissional?u=${slug}`);
    const html = await res.text();
    assert(html.includes('<title>Fran Freela'), 'título pré-renderizado no servidor');
    assert(!html.includes('<script>window.__pwned'), 'XSS escapado no HTML do servidor');
    if (XSS) assert(html.includes('&lt;script&gt;window.__pwned'), 'a carga de ataque chegou ao servidor e foi neutralizada');
    await see(anon.page, 'Painel financeiro para varejo');
    await see(anon.page, '5.0 de 5 (1)');
    await see(anon.page, '1 concluído');
    await see(anon.page, '≈ 5 minutos'); // tempo de resposta medido no chat
    assert(await anon.page.locator('#posts img').evaluate((img) => img.complete && img.naturalWidth === 1200), 'imagem da publicação carrega no perfil público');
    assert(await anon.page.locator('#posts [data-like]').isDisabled(), 'visitante sem login não curte');
    assert(!(await pwned(anon.page)), 'XSS não executa no perfil público');
    await shot(anon.page, '08-perfil-publico');
    await anon.ctx.close();
  });

  await step('busca de profissionais por habilidade: empresa convida e a conversa abre na hora', async () => {
    await c.page.goto(`${APP_URL}/publicar-projeto`);
    await c.page.waitForSelector('#form:not([hidden])');
    await c.page.check('input[name="kind"][value="quick"]');
    await c.page.fill('#title', 'Ajustar consulta SQL lenta');
    await c.page.fill('#description', 'Uma consulta de relatório demora 40 segundos e precisa ser otimizada.');
    await c.page.selectOption('#category', { index: 1 });
    await c.page.fill('#min', '300'); await c.page.fill('#deadline', '3');
    await c.page.click('button[data-status="open"]');
    await c.page.waitForURL('**/projeto?id=*');
    await c.page.goto(`${APP_URL}/profissionais`);
    await c.page.selectOption('#habilidade', { label: 'SQL' });
    await c.page.waitForSelector('#lista [data-invite]');
    await see(c.page, 'Fran Freela');
    await shot(c.page, '16-profissionais');
    await c.page.selectOption('#lista [data-invite] select', { label: 'Ajustar consulta SQL lenta' });
    await c.page.click('#lista [data-invite] button');
    await c.page.waitForURL('**/mensagens?c=*');
    await c.page.fill('#texto', 'Vi seu perfil e acho que você resolve isso rápido. Topa?');
    await c.page.click('#enviar button');
    await c.page.waitForSelector('#thread [data-id]');
    await c.page.goto(`${APP_URL}/profissionais`);
    await c.page.selectOption('#habilidade', { label: 'Go' });
    await see(c.page, 'Nenhum profissional público com essa habilidade');
  });

  await step('vitrine: empresa curte a publicação e solicita serviço a partir dela', async () => {
    await c.page.goto(`${APP_URL}/vitrine`);
    await c.page.waitForSelector('#lista [data-post] img');
    await see(c.page, 'Painel financeiro para varejo');
    await c.page.click('#lista [data-like]');
    await c.page.waitForFunction(() => document.querySelector('#lista [data-likes]').textContent === '1');
    await shot(c.page, '18-vitrine');
    await c.page.reload();
    await c.page.waitForSelector('#lista [data-like][aria-pressed="true"]');
    await c.page.click('#lista a:has-text("Solicitar serviço")');
    await c.page.waitForSelector('#form-convite');
    await shot(c.page, '19-perfil-profissional');
    await c.page.click('#form-convite button');
    await c.page.waitForURL('**/mensagens?c=*');
  });

  await step('canal de denúncia e pedido LGPD pelo suporte; termos publicados', async () => {
    const pid = new URL(projectUrl).searchParams.get('id');
    await f.page.goto(`${APP_URL}/suporte?denunciar=project:${pid}`);
    assert((await f.page.inputValue('#alvo-id')) === pid, 'denúncia iniciada a partir do card já vem identificada');
    await f.page.selectOption('#motivo', 'pagamento_por_fora');
    await f.page.fill('#detalhes', `Pediram para combinar o pagamento por fora da plataforma. ${XSS}`);
    await f.page.click('#form-denuncia button[type=submit]');
    await see(f.page, 'Denúncia recebida');
    await f.page.selectOption('#dsr-tipo', 'acesso');
    await f.page.click('#form-dados button[type=submit]');
    await see(f.page, 'Pedido registrado');
    const anon = await newUser(browser);
    await anon.page.goto(`${APP_URL}/termos`); await see(anon.page, 'não renova automaticamente'); await see(anon.page, 'Regras de conduta');
    await anon.page.goto(`${APP_URL}/privacidade`); await see(anon.page, 'Lei Geral de Proteção de Dados');
    await anon.ctx.close();
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
        cupomDuasVezes: [await send('POST', 'rpc/redeem_coupon', { p_code: 'LANCAMENTO15' }), await send('POST', 'rpc/redeem_coupon', { p_code: 'LANCAMENTO15' })].map((r) => r.status),
        chutarCupom: await send('POST', 'rpc/redeem_coupon', { p_code: 'GRATIS9999' }),
        diasGratis: await send('PATCH', `freelancer_billing?user_id=eq.${session.user.id}`, { trial_days_pending: 90 }),
        publicarVaga: await send('POST', 'jobs', { title: 'Vaga CLT', description: 'Vaga de emprego publicada pela API diretamente.', contract_type: 'clt' }),
        tokensMp: await get('mp_accounts?select=access_token_enc'),
        marcarConectado: await send('PATCH', `freelancer_profiles?user_id=eq.${session.user.id}`, { mp_connected: true }),
        lerOcorrencias: await get('moderation_flags?select=id'),
        tirarSuspensao: await send('PATCH', `profiles?id=eq.${session.user.id}`, { suspended_until: null, response_count: 999 }),
        suspenderOutro: await send('POST', 'rpc/set_user_suspension', { p_user: contractId, p_days: 30, p_reason: 'porque eu quero suspender' }),
        anexoAlheio: await fetch(`${gw}/storage/v1/object/sign/chat-attachments/${contractId}/x/arquivo.xlsx`, { method: 'POST', headers: { apikey: anon, authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: '{"expiresIn":300}' }).then((r) => r.status),
        enviarParaConversaAlheia: await fetch(`${gw}/storage/v1/object/chat-attachments/${contractId}/${session.user.id}/abcdef12.png`, { method: 'POST', headers: { apikey: anon, authorization: `Bearer ${session.access_token}`, 'content-type': 'image/png' }, body: new Uint8Array([137, 80, 78, 71]) }).then((r) => r.status),
        validarEntrega: await send('PATCH', `contract_deliverables?contract_id=eq.${contractId}`, { status: 'accepted' }),
        liberarCredito: await send('PATCH', `payouts?contract_id=eq.${contractId}`, { status: 'paid' }),
        marcarRepasse: await send('POST', 'rpc/mark_payout_paid', { p_payout_id: contractId, p_reference: 'PIX-FALSO' }),
        verCreditos: await get('payouts?select=id'),
        enviarAnuncio: await fetch(`${gw}/storage/v1/object/ads/2026/invasor.png`, { method: 'POST', headers: { apikey: anon, authorization: `Bearer ${session.access_token}`, 'content-type': 'image/png' }, body: new Uint8Array([137, 80, 78, 71]) }).then((r) => r.status),
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
    assert(out.cupomDuasVezes[0] < 300 && out.cupomDuasVezes[1] >= 400, `cupom vale uma vez só (${out.cupomDuasVezes})`);
    assert(out.chutarCupom.status >= 400, 'código inventado não vale');
    assert([401, 403].includes(out.diasGratis.status), `não aumenta os próprios dias grátis (${out.diasGratis.status})`);
    assert([401, 403].includes(out.publicarVaga.status), `não publica vaga de emprego pela API (${out.publicarVaga.status})`);
    assert([401, 403].includes(out.tokensMp.status), `não lê tokens do Mercado Pago (${out.tokensMp.status})`);
    const forged = await i.page.request.get(`${APP_URL}/api/mp/callback?code=abc&state=${new URL(contractUrl).searchParams.get('id')}.9999999999.assinatura-falsa`, { maxRedirects: 0 });
    assert(forged.headers().location === '/perfil?mp=erro', 'autorização forjada do Mercado Pago é recusada');
    assert([401, 403].includes(out.marcarConectado.status), `não se marca como conectado ao Mercado Pago (${out.marcarConectado.status})`);
    assert(out.lerOcorrencias.body.length === 0, 'não lê ocorrências de moderação');
    assert([401, 403].includes(out.tirarSuspensao.status), `não altera suspensão nem tempo de resposta (${out.tirarSuspensao.status})`);
    assert(out.suspenderOutro.status >= 400, 'não suspende outras pessoas');
    assert(out.anexoAlheio >= 400, 'não gera link de anexo de conversa alheia');
    assert(out.enviarParaConversaAlheia === 403, `não envia arquivo para conversa alheia (${out.enviarParaConversaAlheia})`);
    assert([401, 403].includes(out.validarEntrega.status), `não valida entrega pela API (${out.validarEntrega.status})`);
    assert([401, 403].includes(out.liberarCredito.status), `não altera crédito pela API (${out.liberarCredito.status})`);
    assert(out.marcarRepasse.status >= 400, 'não registra repasse');
    assert(out.verCreditos.body.length === 0, 'não vê créditos alheios');
    assert(out.enviarAnuncio === 403, `não envia imagem de anúncio (${out.enviarAnuncio})`);
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
    assert(/assinaturas\s*\n\s*R\$\s?0,00/.test(text), 'período grátis do cupom não é receita');
    assert(!/Créditos retidos|Repasses a fazer/.test(text), 'a plataforma não tem valores de terceiros sob guarda');
    await a.page.waitForSelector('#cupons'); await a.page.waitForSelector('#assinaturas');
    await see(a.page, 'LANCAMENTO15');
    assert(/[12] de 5000 usos/.test(await a.page.locator('#cupons').innerText()), 'usos do cupom contados');

    // denúncia do profissional chegou à moderação, com o texto neutralizado
    await see(a.page, 'pagamento_por_fora');
    assert(!(await pwned(a.page)), 'XSS da denúncia não executa na administração');

    // tentativa de contato por fora feita pela empresa chegou à moderação com o trecho original
    await a.page.waitForSelector('#conduta [data-conduct]');
    await see(a.page, 'Carla Contratante');
    await see(a.page, 'Me chama no whatsapp');
    await shot(a.page, '20-admin-conduta');
    await a.page.fill('#conduta input', 'Primeira ocorrência: usuária orientada sobre as regras.');
    await a.page.click('#conduta button[data-days="0"]');
    await see(a.page, 'Nenhuma ocorrência aguardando revisão');

    // decisão da reclamação: razão ao profissional -> crédito liberado
    await a.page.fill('#disputas textarea', 'O filtro por região consta na página 2, conforme o escopo e a entrega registrada.');
    await a.page.selectOption('#disputas select', 'complete');
    await a.page.click('#disputas button[type=submit]');
    await see(a.page, 'Nenhuma disputa em aberto');
    await f.page.goto(contractUrl);
    await see(f.page, 'Reclamação BICO-');
    await see(f.page, 'Concluído');

    await a.page.waitForSelector('#planos'); await a.page.waitForSelector('#categorias');
    await see(a.page, 'Empresas pedindo para anunciar');
    // arte do anunciante: gerada aqui mesmo, só para o teste
    const artPage = await (await browser.newContext({ viewport: { width: 800, height: 800 } })).newPage();
    await artPage.setContent('<body style="margin:0;display:grid;place-items:center;height:100vh;font-family:sans-serif;background:linear-gradient(135deg,#1d3fbb,#7a2fd0);color:#fff;text-align:center"><div><div style="font-size:34px;opacity:.85">ACME CURSOS</div><div style="font-size:84px;font-weight:800;line-height:1.05;margin:18px 0">Power BI<br>do zero</div><div style="display:inline-block;background:#ffd23f;color:#111;font-size:36px;font-weight:800;padding:14px 34px;border-radius:999px">20% OFF</div></div></body>');
    const art = await artPage.screenshot({ type: 'png' });
    await artPage.context().close();

    // arquivo disfarçado: SVG com script, renomeado para .png
    await a.page.fill('#ad-anunciante', 'Acme Cursos'); await a.page.selectOption('#ad-local', 'sidebar');
    await a.page.fill('#ad-alt', `Curso de Power BI da Acme com 20% de desconto ${XSS}`.slice(0, 160));
    await a.page.fill('#ad-url', 'https://acme.example/curso'); await a.page.fill('#ad-preco', '1.500');
    await a.page.setInputFiles('#ad-imagem', { name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwned=1"><script>window.__pwned=1</script></svg>') });
    await a.page.click('#novo-anuncio button[type=submit]');
    await see(a.page, 'Arquivo recusado');

    await a.page.setInputFiles('#ad-imagem', { name: 'banner.png', mimeType: 'image/png', buffer: art });
    await a.page.click('#novo-anuncio button[type=submit]');
    await a.page.waitForSelector('[data-ad-status="active"]');
    const before = await newUser(browser);
    await before.page.goto(`${APP_URL}/projetos`, { waitUntil: 'networkidle' });
    assert((await before.page.locator('#ad-lateral a.ad').count()) === 0, 'anúncio salvo mas não aprovado não aparece para o público');
    await a.page.click('[data-ad-status="active"]');
    await a.page.waitForSelector('[data-ad-status="paused"]');
    await a.page.locator('#anuncios').scrollIntoViewIfNeeded();
    await shot(a.page, '09-admin');
    await before.page.reload({ waitUntil: 'networkidle' });
    const ad = before.page.locator('#ad-lateral a.ad');
    await ad.waitFor({ state: 'visible' });
    assert(await ad.locator('img').evaluate((img) => img.complete && img.naturalWidth === 800), 'a imagem do anunciante carrega no espaço');
    await see(before.page, 'Patrocinado');
    assert(!(await pwned(before.page)), 'XSS não executa no anúncio');
    const rel = await ad.getAttribute('rel');
    assert(/sponsored/.test(rel) && /noopener/.test(rel), 'link de anúncio marcado como patrocinado e isolado');
    await shot(before.page, '13-projetos-com-anuncio');
    await before.page.goto(APP_URL, { waitUntil: 'networkidle' });
    await shot(before.page, '14-inicio-com-oportunidades');
    await before.ctx.close();
    await a.ctx.close();
  });

  await step('celular: páginas principais sem rolagem horizontal', async () => {
    const m = await newUser(browser, { ...devices['iPhone 13'] });
    for (const path of ['/', '/projetos', '/vitrine', '/profissionais', '/termos', `/profissional?u=${slug}`]) {
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
