import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderChain } from '../src/providers/chain.js';
import { MemoryCache } from '../src/lib/cache.js';
import { ProviderError, ProviderNotFound } from '../src/lib/errors.js';
import { requestJson } from '../src/lib/http.js';
import { createBrasilApiCnpjProvider } from '../src/providers/cnpj/brasilApi.js';
import { createViaCepProvider } from '../src/providers/cep/viaCep.js';
import { createBrasilApiCepProvider } from '../src/providers/cep/brasilApi.js';
import { createLogger } from '../src/lib/logger.js';
import { fakeFetch, jsonResponse } from './helpers.js';

const logger = createLogger({ silent: true });
const chain = (providers, extra = {}) => new ProviderChain({ kind: 'cep', providers, memory: new MemoryCache(), ttlSeconds: 60, logger, ...extra });

test('cadeia: usa o primeiro provedor e guarda em cache', async () => {
  let calls = 0;
  const c = chain([{ name: 'a', lookup: async () => { calls += 1; return { city: 'São Paulo' }; } }]);
  const first = await c.lookup('01001000');
  const second = await c.lookup('01001000');
  assert.equal(first.source, 'provider');
  assert.equal(second.source, 'cache');
  assert.equal(second.data.provider, 'a');
  assert.equal(calls, 1);
});

test('cadeia: cai para o provedor alternativo quando o primeiro falha', async () => {
  const outcomes = [];
  const c = chain([
    { name: 'a', lookup: async () => { throw new ProviderError('timeout', { kind: 'timeout' }); } },
    { name: 'b', lookup: async () => ({ city: 'Recife' }) },
  ], { onCall: (o) => outcomes.push(`${o.provider}:${o.outcome}`) });
  const r = await c.lookup('50000000');
  assert.equal(r.status, 'ok');
  assert.equal(r.data.provider, 'b');
  assert.deepEqual(outcomes, ['a:timeout', 'b:ok']);
});

test('cadeia: not_found só quando todos os consultados dizem que não existe', async () => {
  const nf = { name: 'a', lookup: async () => { throw new ProviderNotFound(); } };
  const down = { name: 'b', lookup: async () => { throw new ProviderError('HTTP 503'); } };
  assert.equal((await chain([nf, { ...nf, name: 'c' }]).lookup('1')).status, 'not_found');
  assert.equal((await chain([nf, down]).lookup('1')).status, 'unavailable');
  assert.equal((await chain([down]).lookup('1')).status, 'unavailable');
});

test('cadeia: disjuntor pula provedor instável e volta após o intervalo', async () => {
  let now = 0; let aCalls = 0;
  const c = chain([
    { name: 'a', lookup: async () => { aCalls += 1; throw new ProviderError('HTTP 500'); } },
    { name: 'b', lookup: async (k) => ({ k }) },
  ], { breakerThreshold: 2, breakerCooldownMs: 1000, now: () => now });
  await c.lookup('1'); await c.lookup('2'); // 2 falhas => abre
  await c.lookup('3');
  assert.equal(aCalls, 2, 'provedor instável não é chamado com o disjuntor aberto');
  now = 2000;
  await c.lookup('4');
  assert.equal(aCalls, 3, 'volta a tentar depois do intervalo');
});

test('cadeia: usa cache persistente e sobrevive à falha dele', async () => {
  const store = { get: async () => ({ city: 'Cache', provider: 'a' }), set: async () => {} };
  const r = await chain([{ name: 'a', lookup: async () => { throw new Error('não deveria chamar'); } }], { store }).lookup('9');
  assert.equal(r.source, 'cache');
  const broken = { get: async () => { throw new Error('db fora'); }, set: async () => { throw new Error('db fora'); } };
  const r2 = await chain([{ name: 'a', lookup: async () => ({ city: 'Ok' }) }], { store: broken }).lookup('9');
  assert.equal(r2.status, 'ok');
});

test('http: repete 5xx uma vez, não repete 429, respeita timeout', async () => {
  let n = 0;
  const flaky = async () => { n += 1; return n === 1 ? jsonResponse(502, {}) : jsonResponse(200, { ok: 1 }); };
  assert.deepEqual((await requestJson('http://x', { fetchImpl: flaky, retryDelayMs: 1 })).json, { ok: 1 });
  assert.equal(n, 2);

  let m = 0;
  const limited = async () => { m += 1; return jsonResponse(429, {}); };
  await assert.rejects(requestJson('http://x', { fetchImpl: limited, retryDelayMs: 1 }), (e) => e.kind === 'rate_limited');
  assert.equal(m, 1);

  // o timer de AbortSignal.timeout não segura o processo; mantemos um timer ativo durante a espera
  const slow = (_u, init) => new Promise((_res, rej) => {
    const keepAlive = setTimeout(() => {}, 2000);
    init.signal.addEventListener('abort', () => { clearTimeout(keepAlive); rej(init.signal.reason); });
  });
  await assert.rejects(requestJson('http://x', { fetchImpl: slow, timeoutMs: 20, retries: 0 }), (e) => e.kind === 'timeout');
});

test('BrasilAPI CNPJ: normaliza campos e descarta sócios', async () => {
  const fetchImpl = fakeFetch({ '/api/cnpj/v1/': () => jsonResponse(200, {
    cnpj: '00000000000191', razao_social: 'BANCO DO BRASIL SA', nome_fantasia: 'DIRECAO GERAL',
    descricao_situacao_cadastral: 'ATIVA', data_inicio_atividade: '1966-08-01', natureza_juridica: 'Sociedade de Economia Mista',
    porte: 'DEMAIS', cnae_fiscal: 6422100, cnae_fiscal_descricao: 'Bancos múltiplos, com carteira comercial',
    cnaes_secundarios: [{ codigo: 6499999, descricao: 'Outras atividades' }, { codigo: 0, descricao: '' }],
    descricao_tipo_de_logradouro: 'QUADRA', logradouro: 'SAUN QUADRA 5 LOTE B', numero: 'S/N', complemento: '', bairro: 'ASA NORTE',
    municipio: 'BRASILIA', uf: 'DF', cep: '70040912', ddd_telefone_1: '6134939002', email: 'SECEX@BB.COM.BR', codigo_municipio_ibge: 5300108,
    qsa: [{ nome_socio: 'FULANO DE TAL', cnpj_cpf_do_socio: '***000000**' }],
  }) });
  const data = await createBrasilApiCnpjProvider({ fetchImpl }).lookup('00000000000191');
  assert.equal(data.legalName, 'BANCO DO BRASIL SA');
  assert.equal(data.registryStatus, 'ATIVA');
  assert.deepEqual(data.mainCnae, { code: '6422100', description: 'Bancos múltiplos, com carteira comercial' });
  assert.equal(data.secondaryCnaes.length, 1);
  assert.equal(data.address.street, 'QUADRA SAUN QUADRA 5 LOTE B');
  assert.equal(data.address.ibgeCode, '5300108');
  assert.equal(data.address.complement, null);
  assert.equal(data.email, 'secex@bb.com.br');
  assert.equal(JSON.stringify(data).includes('FULANO'), false, 'dados de sócios não são repassados');
});

test('BrasilAPI CNPJ: 404 => não encontrado; 400/500 => falha do provedor', async () => {
  const p = (status) => createBrasilApiCnpjProvider({ fetchImpl: fakeFetch({ cnpj: () => jsonResponse(status, { message: 'x' }) }) });
  await assert.rejects(p(404).lookup('1'), ProviderNotFound);
  await assert.rejects(p(400).lookup('1'), ProviderError);
});

test('ViaCEP: sucesso, {erro:true} e BrasilAPI CEP', async () => {
  const ok = createViaCepProvider({ fetchImpl: fakeFetch({ '/ws/': () => jsonResponse(200, { cep: '01001-000', logradouro: 'Praça da Sé', complemento: 'lado ímpar', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308' }) }) });
  assert.deepEqual(await ok.lookup('01001000'), { cep: '01001000', street: 'Praça da Sé', district: 'Sé', city: 'São Paulo', uf: 'SP', ibgeCode: '3550308' });
  for (const erro of [true, 'true']) {
    const nf = createViaCepProvider({ fetchImpl: fakeFetch({ '/ws/': () => jsonResponse(200, { erro }) }) });
    await assert.rejects(nf.lookup('99999999'), ProviderNotFound);
  }
  const b = createBrasilApiCepProvider({ fetchImpl: fakeFetch({ '/api/cep/v1/': () => jsonResponse(200, { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Sé', street: 'Praça da Sé' }) }) });
  assert.equal((await b.lookup('01001000')).ibgeCode, null);
});
