import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApp, fakeFetch, fakeStore, jsonResponse } from './helpers.js';
import { verifyWebhookSignature, buildManifest } from '../src/services/mercadoPago.js';
import { createLogger } from '../src/lib/logger.js';
import { decrypt, encrypt, loadKey, signState, verifyState } from '../src/lib/crypto.js';

const viaCepOk = () => jsonResponse(200, { cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308' });
const cnpjOk = () => jsonResponse(200, { razao_social: 'EMPRESA REAL LTDA', nome_fantasia: 'Empresa Real', descricao_situacao_cadastral: 'ATIVA', data_inicio_atividade: '2020-01-15', cnae_fiscal: 6201501, cnae_fiscal_descricao: 'Desenvolvimento de software', qsa: [{ nome_socio: 'SOCIO X' }] });
const address = { cep: '01001-000', street: 'Praça da Sé', number: '100', district: 'Sé', city: 'São Paulo', uf: 'SP', ibgeCode: '3550308' };
const auth = (t) => ({ authorization: `Bearer ${t}` });

test('GET /api/cep: preenche endereço, valida formato e não bloqueia quando o serviço cai', async (t) => {
  const fetchImpl = fakeFetch({ 'viacep.com.br': viaCepOk });
  const app = await startApp({ fetchImpl });
  t.after(app.close);

  const ok = await app.get('/api/cep/01001-000');
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).address, { cep: '01001000', street: 'Praça da Sé', district: 'Sé', city: 'São Paulo', uf: 'SP', ibgeCode: '3550308' });
  await app.get('/api/cep/01001000');
  assert.equal(fetchImpl.calls.length, 1, 'segunda consulta sai do cache');

  assert.equal((await app.get('/api/cep/123')).status, 400);

  const down = await startApp({ fetchImpl: fakeFetch({ viacep: () => jsonResponse(503), brasilapi: () => { throw new Error('ECONNRESET'); } }) });
  t.after(down.close);
  const r = await down.get('/api/cep/01001000');
  assert.equal(r.status, 200);
  assert.deepEqual({ available: (await r.clone().json()).available, manual: (await r.json()).manual }, { available: false, manual: true });

  const nf = await startApp({ fetchImpl: fakeFetch({ viacep: () => jsonResponse(200, { erro: true }), brasilapi: () => jsonResponse(404, {}) }) });
  t.after(nf.close);
  assert.equal((await nf.get('/api/cep/99999999')).status, 404);
});

test('GET /api/cnpj: exige login, valida DV, avisa que não é atestado de idoneidade', async (t) => {
  const app = await startApp({ fetchImpl: fakeFetch({ '/api/cnpj/': cnpjOk }) });
  t.after(app.close);
  assert.equal((await app.get('/api/cnpj/00000000000191')).status, 401);
  assert.equal((await app.get('/api/cnpj/00000000000191', auth('token-falso'))).status, 401);
  assert.equal((await app.get('/api/cnpj/00000000000192', auth('tok-company'))).status, 400);
  const res = await app.get('/api/cnpj/00.000.000%2F0001-91', auth('tok-company'));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.company.legalName, 'EMPRESA REAL LTDA');
  assert.match(body.notice, /não atesta idoneidade/);
  assert.equal(JSON.stringify(body).includes('SOCIO'), false);
});

test('GET /api/cnpj: provedor fora do ar => cadastro manual, sem erro 5xx', async (t) => {
  const app = await startApp({ fetchImpl: fakeFetch({ '/api/cnpj/': () => jsonResponse(500) }) });
  t.after(app.close);
  const res = await app.get('/api/cnpj/12ABC34501DE35', auth('tok-company'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json().then((b) => [b.available, b.manual]), [false, true]);
});

test('GET /api/cnpj: limite de requisições por usuário', async (t) => {
  const app = await startApp({ fetchImpl: fakeFetch({ '/api/cnpj/': cnpjOk }) });
  t.after(app.close);
  const codes = [];
  for (let i = 0; i < 12; i += 1) codes.push((await app.get('/api/cnpj/00000000000191', auth('tok-company'))).status);
  assert.deepEqual(codes.slice(0, 10), Array(10).fill(200));
  assert.deepEqual(codes.slice(10), [429, 429]);
});

test('POST /api/companies: dados cadastrais vêm do servidor, não do navegador', async (t) => {
  const app = await startApp({ fetchImpl: fakeFetch({ '/api/cnpj/': cnpjOk }) });
  t.after(app.close);
  const payload = { personType: 'pj', cnpj: '00.000.000/0001-91', legalName: 'NOME FORJADO', registryStatus: 'ATIVA FORJADA', address, addressConfirmed: true, website: 'https://empresa.example' };

  assert.equal((await app.post('/api/companies', payload)).status, 401);
  assert.equal((await app.post('/api/companies', payload, auth('tok-freela'))).status, 403, 'conta freelancer não cria empresa');
  assert.equal((await app.post('/api/companies', { ...payload, addressConfirmed: false }, auth('tok-company'))).status, 400);
  assert.equal((await app.post('/api/companies', { ...payload, cnpj: '00000000000192' }, auth('tok-company'))).status, 400);
  assert.equal((await app.post('/api/companies', { ...payload, website: 'javascript:alert(1)' }, auth('tok-company'))).status, 400);
  assert.equal((await app.post('/api/companies', { ...payload, personType: 'pf', cpf: '52998224725' }, auth('tok-company'))).status, 403, 'PF desabilitada por padrão');

  const res = await app.post('/api/companies', payload, auth('tok-company'));
  assert.equal(res.status, 201);
  const saved = app.store.state.companies[0];
  assert.equal(saved.privateData.legal_name, 'EMPRESA REAL LTDA');
  assert.equal(saved.company.registry_status, 'ATIVA');
  assert.equal(saved.company.cnpj_masked, '00.***.***/0001-**');
  assert.equal(saved.company.display_name, 'Empresa Real');
  assert.equal(saved.privateData.cep, '01001000');
  assert.match(saved.company.slug, /^empresa-real-[0-9a-f]{6}$/);
  assert.equal(JSON.stringify(saved).includes('SOCIO'), false);

  assert.equal((await app.post('/api/companies', payload, auth('tok-company'))).status, 409, 'uma empresa por conta');
});

test('POST /api/companies: consulta indisponível => aceita dados manuais e marca como não consultado', async (t) => {
  const app = await startApp({ fetchImpl: fakeFetch({ '/api/cnpj/': () => jsonResponse(503) }) });
  t.after(app.close);
  const res = await app.post('/api/companies', { cnpj: '12.ABC.345/01DE-35', legalName: 'Nova Empresa Ltda', displayName: 'Nova Empresa', address, addressConfirmed: true }, auth('tok-company'));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).registryChecked, false);
  const saved = app.store.state.companies[0];
  assert.equal(saved.privateData.cnpj, '12ABC34501DE35');
  assert.equal(saved.company.registry_status, null);
  assert.equal(saved.privateData.legal_name, 'Nova Empresa Ltda');
});

// ---------------------------------------------------------------- Mercado Pago
const SECRET = 'segredo-de-teste';
const sign = ({ dataId, requestId, ts = '1742505638683', secret = SECRET }) =>
  `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(buildManifest({ dataId, requestId, ts })).digest('hex')}`;
const PAYMENT_UUID = '3f0e7a52-8a43-4b7e-9c1d-2f6f8f1f2a10';

test('assinatura do webhook: manifesto e comparação', () => {
  assert.equal(buildManifest({ dataId: 'ABC123', requestId: 'req-1', ts: '10' }), 'id:abc123;request-id:req-1;ts:10;');
  assert.equal(buildManifest({ dataId: '', requestId: '', ts: '10' }), 'ts:10;');
  const signatureHeader = sign({ dataId: '123', requestId: 'r1' });
  assert.equal(verifyWebhookSignature({ signatureHeader, requestId: 'r1', dataId: '123', secret: SECRET }), true);
  assert.equal(verifyWebhookSignature({ signatureHeader, requestId: 'r1', dataId: '124', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ signatureHeader, requestId: 'r2', dataId: '123', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ signatureHeader, requestId: 'r1', dataId: '123', secret: '' }), false, 'sem segredo configurado nada é aceito');
  assert.equal(verifyWebhookSignature({ signatureHeader: 'ts=1,v1=zz', requestId: 'r1', dataId: '123', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ signatureHeader: undefined, requestId: 'r1', dataId: '123', secret: SECRET }), false);
});

test('webhook: recusa assinatura inválida sem gravar nada', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const body = { type: 'payment', action: 'payment.updated', data: { id: '999' } };
  const noSig = await app.post('/api/webhooks/mercadopago?data.id=999&type=payment', body);
  const wrong = await app.post('/api/webhooks/mercadopago?data.id=999&type=payment', body, { 'x-request-id': 'r1', 'x-signature': sign({ dataId: '999', requestId: 'r1', secret: 'outro-segredo' }) });
  assert.deepEqual([noSig.status, wrong.status], [401, 401]);
  assert.equal(app.store.state.events.size, 0);
});

test('webhook: confirma pelo que a API do Mercado Pago diz, não pelo corpo recebido; é idempotente', async (t) => {
  let apiCalls = 0;
  const mp = { getPayment: async (id) => { apiCalls += 1; return { id, status: 'pending', statusDetail: 'pending_waiting_transfer', amountCents: 15000, currency: 'BRL', externalReference: PAYMENT_UUID }; } };
  const app = await startApp({ mp });
  t.after(app.close);
  const headers = { 'x-request-id': 'r1', 'x-signature': sign({ dataId: '777', requestId: 'r1' }) };
  // corpo mente dizendo "approved": deve ser ignorado
  const body = { type: 'payment', action: 'payment.updated', data: { id: '777', status: 'approved' }, status: 'approved' };
  const first = await app.post('/api/webhooks/mercadopago?data.id=777&type=payment', body, headers);
  assert.equal(first.status, 200);
  assert.deepEqual(app.store.state.paymentUpdates, [{ paymentId: PAYMENT_UUID, providerPaymentId: '777', status: 'pending', statusDetail: 'pending_waiting_transfer', amountCents: 15000 }]);

  const again = await app.post('/api/webhooks/mercadopago?data.id=777&type=payment', body, headers);
  assert.equal((await again.json()).duplicate, true);
  assert.equal(apiCalls, 1, 'evento repetido não é reprocessado');
});

test('webhook: falha no processamento devolve 500 (para reenvio) e o reenvio é processado', async (t) => {
  let fail = true;
  const mp = { getPayment: async (id) => { if (fail) throw new Error('MP fora do ar'); return { id, status: 'approved', statusDetail: 'accredited', amountCents: 2990, currency: 'BRL', externalReference: PAYMENT_UUID }; } };
  const app = await startApp({ mp });
  t.after(app.close);
  const headers = { 'x-request-id': 'r9', 'x-signature': sign({ dataId: '555', requestId: 'r9' }) };
  const body = { type: 'payment', action: 'payment.created', data: { id: '555' } };
  assert.equal((await app.post('/api/webhooks/mercadopago?data.id=555&type=payment', body, headers)).status, 500);
  fail = false;
  assert.equal((await app.post('/api/webhooks/mercadopago?data.id=555&type=payment', body, headers)).status, 200);
  assert.equal(app.store.state.paymentUpdates.length, 1);
});

test('webhook: pagamento sem referência nossa ou em outra moeda não altera nada', async (t) => {
  for (const [payment, expected] of [
    [{ id: '1', status: 'approved', amountCents: 100, currency: 'BRL', externalReference: 'qualquer-coisa' }, 'no_external_reference'],
    [{ id: '1', status: 'approved', amountCents: 100, currency: 'USD', externalReference: PAYMENT_UUID }, 'unexpected_currency'],
  ]) {
    const app = await startApp({ mp: { getPayment: async () => payment } });
    t.after(app.close);
    const res = await app.post('/api/webhooks/mercadopago?data.id=1&type=payment', { type: 'payment', action: 'x', data: { id: '1' } }, { 'x-request-id': 'r', 'x-signature': sign({ dataId: '1', requestId: 'r' }) });
    assert.equal((await res.json()).outcome, expected);
    assert.equal(app.store.state.paymentUpdates.length, 0);
  }
});

test('checkout de projeto: pagamento dividido com a conta do profissional; valor e taxa vêm do banco', async (t) => {
  const created = [];
  const mp = { configured: true, marketplaceConfigured: true, getPayment: async () => null, createPreference: async (p) => { created.push(p); return { preferenceId: 'pref-1', checkoutUrl: 'https://mp.example/checkout/pref-1' }; } };
  const app = await startApp({ mp });
  t.after(app.close);
  const key = loadKey('ab'.repeat(32));
  app.store.payments.set(PAYMENT_UUID, { id: PAYMENT_UUID, kind: 'deposit', status: 'pending', amount_cents: 165000, payer_id: 'user-company', contract_id: 'c-1', checkout_url: null, contracts: { freelancer_id: 'user-freela', deposit_cents: 15000, projects: { title: 'Dashboard' } } });
  const url = `/api/payments/${PAYMENT_UUID}/checkout`;

  assert.equal((await app.post(url, {})).status, 401);
  assert.equal((await app.post(url, {}, auth('tok-freela'))).status, 404, 'cobrança de outro usuário parece inexistente');
  assert.equal((await app.post('/api/payments/nao-e-uuid/checkout', {}, auth('tok-company'))).status, 400);
  assert.equal((await app.post(url, {}, auth('tok-company'))).status, 409, 'sem conta do profissional conectada não há cobrança');

  app.store.mpAccounts.set('user-freela', { user_id: 'user-freela', mp_user_id: '777', access_token_enc: encrypt('TOKEN-DO-PROFISSIONAL', key), refresh_token_enc: null, expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
  // o navegador tenta impor outro valor e outra taxa: é ignorado
  const res = await app.post(url, { amount_cents: 1, marketplace_fee: 0 }, auth('tok-company'));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).checkoutUrl, 'https://mp.example/checkout/pref-1');
  assert.equal(created[0].amountCents, 165000);
  assert.equal(created[0].marketplaceFeeCents, 15000, 'taxa do Bico BR separada pelo Mercado Pago');
  assert.equal(created[0].sellerAccessToken, 'TOKEN-DO-PROFISSIONAL', 'cobrança criada na conta do profissional: a plataforma não recebe a parte dele');
  assert.equal(created[0].notificationUrl, `https://bicobr.example/api/webhooks/mercadopago?ref=${PAYMENT_UUID}`);

  await app.post(url, {}, auth('tok-company'));
  assert.equal(created.length, 1, 'segunda chamada reaproveita o checkout');
  app.store.payments.get(PAYMENT_UUID).status = 'approved';
  assert.equal((await app.post(url, {}, auth('tok-company'))).status, 409);
});

test('conexão Mercado Pago: state assinado, tokens cifrados no armazenamento', async (t) => {
  const mp = { configured: true, marketplaceConfigured: true, exchangeCode: async (code, redirect) => ({ accessToken: `ACCESS-${code}`, refreshToken: 'REFRESH-1', mpUserId: '555', expiresAt: '2027-01-01T00:00:00.000Z', redirect }) };
  const app = await startApp({ mp });
  t.after(app.close);
  assert.equal((await app.get('/api/mp/connect')).status, 401);
  assert.equal((await app.get('/api/mp/connect', auth('tok-company'))).status, 403, 'empresa não conecta conta para receber');
  const { url } = await (await app.get('/api/mp/connect', auth('tok-freela'))).json();
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://auth.mercadopago.com.br/authorization');
  assert.equal(u.searchParams.get('client_id'), 'app-123');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://bicobr.example/api/mp/callback');
  assert.equal(url.includes('segredo-do-app'), false, 'o segredo do aplicativo nunca vai para o navegador');
  const state = u.searchParams.get('state');

  const noFollow = (p) => fetch(app.base + p, { redirect: 'manual' });
  const forged = await noFollow(`/api/mp/callback?code=abc&state=${state.replace('user-freela', 'user-company')}`);
  assert.equal(forged.headers.get('location'), '/perfil?mp=erro', 'state adulterado é recusado');
  assert.equal(app.store.mpAccounts.size, 0);
  const ok = await noFollow(`/api/mp/callback?code=abc&state=${state}`);
  assert.equal(ok.headers.get('location'), '/perfil?mp=ok');
  const saved = app.store.mpAccounts.get('user-freela');
  assert.equal(JSON.stringify(saved).includes('ACCESS-abc'), false, 'token não é guardado em texto puro');
  assert.equal(decrypt(saved.access_token_enc, loadKey('ab'.repeat(32))), 'ACCESS-abc');
  assert.equal(verifyState(signState('u1', loadKey('ab'.repeat(32)), 900, Date.now() - 3600_000), loadKey('ab'.repeat(32))), null, 'state vencido é recusado');
  assert.throws(() => decrypt(saved.access_token_enc.slice(0, -4) + 'AAAA', loadKey('ab'.repeat(32))), 'cifra adulterada é detectada');
});

test('webhook de projeto consulta o pagamento com a conta do profissional e confere a referência', async (t) => {
  const used = [];
  const mp = { configured: true, getPayment: async (id, token) => { used.push(token); return { id, status: 'approved', statusDetail: 'accredited', amountCents: 165000, currency: 'BRL', externalReference: PAYMENT_UUID }; } };
  const app = await startApp({ mp });
  t.after(app.close);
  const key = loadKey('ab'.repeat(32));
  app.store.payments.set(PAYMENT_UUID, { id: PAYMENT_UUID, kind: 'deposit', status: 'pending', amount_cents: 165000, payer_id: 'user-company', contracts: { freelancer_id: 'user-freela', deposit_cents: 15000 } });
  app.store.mpAccounts.set('user-freela', { access_token_enc: encrypt('TOKEN-DO-PROFISSIONAL', key), expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
  const headers = { 'x-request-id': 'r1', 'x-signature': sign({ dataId: '900', requestId: 'r1' }) };
  const res = await app.post(`/api/webhooks/mercadopago?data.id=900&type=payment&ref=${PAYMENT_UUID}`, { type: 'payment', action: 'payment.created', data: { id: '900' } }, headers);
  assert.equal((await res.json()).outcome, 'approved');
  assert.deepEqual(used, ['TOKEN-DO-PROFISSIONAL']);
  // referência trocada na URL não redireciona o pagamento para outro registro
  const other = '11111111-2222-4333-8444-555555555555';
  app.store.payments.set(other, { id: other, kind: 'subscription', status: 'pending', amount_cents: 2500, payer_id: 'user-freela' });
  const h2 = { 'x-request-id': 'r2', 'x-signature': sign({ dataId: '901', requestId: 'r2' }) };
  const res2 = await app.post(`/api/webhooks/mercadopago?data.id=901&type=payment&ref=${other}`, { type: 'payment', action: 'payment.created', data: { id: '901' } }, h2);
  assert.equal((await res2.json()).outcome, 'reference_mismatch');
  assert.equal(app.store.state.paymentUpdates.length, 1);
});

test('checkout: sem credenciais do Mercado Pago responde 503, sem inventar pagamento', async (t) => {
  const app = await startApp({ mp: { configured: false, marketplaceConfigured: false } });
  t.after(app.close);
  app.store.payments.set(PAYMENT_UUID, { id: PAYMENT_UUID, kind: 'subscription', status: 'pending', amount_cents: 2990, payer_id: 'user-freela', plans: { name: 'Bico BR Pro' } });
  assert.equal((await app.post(`/api/payments/${PAYMENT_UUID}/checkout`, {}, auth('tok-freela'))).status, 503);
});

test('segurança: HTTPS forçado, cabeçalhos, CAPTCHA opcional e id de webhook estrito', async (t) => {
  const prod = await startApp({ env: { FORCE_HTTPS: 'true', TRUST_PROXY: '1', TURNSTILE_SITE_KEY: '0x4AAAA-chave-publica' } });
  t.after(prod.close);
  const plain = await fetch(`${prod.base}/projetos?x=1`, { redirect: 'manual' });
  assert.deepEqual([plain.status, plain.headers.get('location')], [308, 'https://bicobr.example/projetos?x=1']);
  const viaProxy = await fetch(`${prod.base}/api/config`, { headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(viaProxy.status, 200);
  assert.match(viaProxy.headers.get('strict-transport-security'), /max-age=63072000; includeSubDomains; preload/);
  assert.match(viaProxy.headers.get('permissions-policy'), /camera=\(\)/);
  assert.equal(viaProxy.headers.get('x-content-type-options'), 'nosniff');
  const csp = viaProxy.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal((await viaProxy.json()).turnstileSiteKey, '0x4AAAA-chave-publica');

  const dev = await startApp();
  t.after(dev.close);
  const devCsp = (await dev.get('/api/config')).headers.get('content-security-policy');
  assert.equal(/cloudflare/.test(devCsp), false, 'sem CAPTCHA configurado, nenhum domínio externo é liberado');
  assert.match(devCsp, /frame-src 'none'/);
  const bad = await dev.post("/api/webhooks/mercadopago?data.id=../../oauth/token&type=payment", {}, { 'x-request-id': 'r', 'x-signature': sign({ dataId: '../../oauth/token', requestId: 'r' }) });
  assert.equal(bad.status, 400, 'id de pagamento fora do formato é recusado mesmo com assinatura válida');
});

// ---------------------------------------------------------------- transversais
test('/api/config expõe só valores públicos; cabeçalhos de segurança presentes', async (t) => {
  const app = await startApp({ env: { MP_ACCESS_TOKEN: 'TOKEN-SECRETO-MP', SERPRO_CONSUMER_SECRET: 'SEGREDO-SERPRO' } });
  t.after(app.close);
  const res = await app.get('/api/config');
  const raw = await res.text();
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['allowPfContractors', 'supabaseAnonKey', 'supabaseUrl', 'turnstileSiteKey']);
  for (const secret of ['srv', 'TOKEN-SECRETO-MP', 'SEGREDO-SERPRO', 'segredo-de-teste']) assert.equal(raw.includes(secret), false);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
});

test('robots.txt bloqueia áreas privadas e sitemap escapa XML', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const robots = await (await app.get('/robots.txt')).text();
  for (const p of ['/api/', '/painel', '/admin', '/mensagens', '/contratos']) assert.match(robots, new RegExp(`Disallow: ${p}`));
  assert.match(robots, /Sitemap: https:\/\/bicobr\.example\/sitemap\.xml/);
  const sitemap = await (await app.get('/sitemap.xml')).text();
  assert.match(sitemap, /projetos\?categoria=design<\/loc><lastmod>2026-11-01/);
  assert.equal(sitemap.includes('/vagas'), false, 'vagas de emprego saíram do site');
  const moved = await fetch(`${app.base}/vagas`, { redirect: 'manual' });
  assert.deepEqual([moved.status, moved.headers.get('location')], [301, '/projetos']);
  assert.equal(sitemap.includes('/painel'), false);
});

test('logger remove campos sensíveis', () => {
  const lines = [];
  createLogger({ sink: (l) => lines.push(l) }).info('x', { accessToken: 'abc', nested: { cpf: '123', ok: 1 }, authorization: 'Bearer z' });
  assert.equal(/abc|Bearer z|"123"/.test(lines[0]), false);
  assert.match(lines[0], /"ok":1/);
});

test('rota de API inexistente => 404 JSON; corpo inválido => 400', async (t) => {
  const app = await startApp();
  t.after(app.close);
  assert.equal((await app.get('/api/nao-existe')).status, 404);
  const bad = await fetch(`${app.base}/api/companies`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer tok-company' }, body: '{quebrado' });
  assert.equal(bad.status, 400);
});
