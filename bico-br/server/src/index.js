import { loadConfig, configProblems } from './config.js';
import { createLogger } from './lib/logger.js';
import { createSupabaseStore } from './lib/store.js';
import { buildRegistries } from './providers/index.js';
import { createMercadoPagoClient } from './services/mercadoPago.js';
import { createApp } from './app.js';

const config = loadConfig();
const logger = createLogger();

const problems = configProblems(config);
if (problems.length) {
  if (config.env === 'production') {
    logger.error('configuração incompleta — encerrando', { problems });
    process.exit(1);
  }
  logger.warn('configuração incompleta (modo desenvolvimento: recursos dependentes ficam desligados)', { problems });
}

const hasDb = Boolean(config.supabase.url && config.supabase.serviceRoleKey);
// Sem Supabase configurado o servidor sobe só com páginas estáticas e consulta de CEP.
const store = hasDb ? createSupabaseStore(config.supabase) : {
  getUserFromToken: async () => null,
};
const registries = buildRegistries({
  config, logger,
  store: hasDb ? store.cache : null,
  onCall: hasDb ? (call) => { if (call.outcome !== 'cache_hit') store.logExternalCall(call).catch(() => {}); } : undefined,
});
const mp = createMercadoPagoClient(config.mercadoPago);

const app = createApp({ config, store, registries, mp, logger });
const server = app.listen(config.port, () => logger.info('Bico BR no ar', { port: config.port, env: config.env }));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000).unref(); });
}
