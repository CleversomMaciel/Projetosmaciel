import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/lib/logger.js';
import { buildRegistries } from '../src/providers/index.js';
import { createApp } from '../src/app.js';

export const jsonResponse = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status });

/** fetch falso: roteia por trecho da URL e conta chamadas. */
export function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    for (const [needle, handler] of Object.entries(routes)) {
      if (String(url).includes(needle)) return handler(String(url), init);
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  impl.calls = calls;
  return impl;
}

/** Store em memória com a mesma interface de lib/store.js */
export function fakeStore(overrides = {}) {
  const state = { companies: [], events: new Map(), paymentUpdates: [], onboarded: [] };
  return {
    state,
    getUserFromToken: async (t) => ({ 'tok-company': { id: 'user-company' }, 'tok-freela': { id: 'user-freela' } }[t] ?? null),
    getProfile: async (id) => ({ id, account_type: id === 'user-company' ? 'company' : 'freelancer' }),
    companyExistsByCnpj: async (cnpj) => state.companies.some((c) => c.privateData.cnpj === cnpj),
    countCompaniesByOwner: async (owner) => state.companies.filter((c) => c.company.owner_id === owner).length,
    createCompany: async (row) => { state.companies.push(row); return { id: 'company-1', slug: row.company.slug }; },
    markOnboarded: async (id) => { state.onboarded.push(id); },
    registerWebhookEvent: async ({ dedupeKey }) => {
      if (!state.events.has(dedupeKey)) { state.events.set(dedupeKey, 'pending'); return 'new'; }
      return state.events.get(dedupeKey);
    },
    finishWebhookEvent: async ({ dedupeKey, error }) => { if (!error) state.events.set(dedupeKey, 'done'); },
    processPaymentUpdate: async (u) => { state.paymentUpdates.push(u); return 'approved'; },
    sitemapEntries: async () => ({ categories: [{ slug: 'design', updated_at: '2026-11-01T00:00:00Z' }], projects: [], jobs: [], freelancers: [{ slug: 'ana&bia', updated_at: null }] }),
    ...overrides,
  };
}

export async function startApp({ env = {}, fetchImpl, store = fakeStore(), mp } = {}) {
  const config = loadConfig({
    SUPABASE_URL: 'https://exemplo.supabase.co', SUPABASE_ANON_KEY: 'anon-publica', SUPABASE_SERVICE_ROLE_KEY: 'srv',
    MP_WEBHOOK_SECRET: 'segredo-de-teste', PUBLIC_URL: 'https://bicobr.example', ...env,
  });
  const logger = createLogger({ silent: true });
  const registries = buildRegistries({ config, logger, fetchImpl });
  const app = createApp({ config, store, registries, mp: mp ?? { getPayment: async () => null }, logger });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, store, config,
    get: (p, headers = {}) => fetch(base + p, { headers }),
    post: (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }),
    close: () => new Promise((r) => server.close(r)),
  };
}
