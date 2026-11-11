import { MemoryCache } from '../lib/cache.js';
import { ProviderChain } from './chain.js';
import { createBrasilApiCnpjProvider } from './cnpj/brasilApi.js';
import { createSerproCnpjProvider } from './cnpj/serpro.js';
import { createViaCepProvider } from './cep/viaCep.js';
import { createBrasilApiCepProvider } from './cep/brasilApi.js';

/** Monta as cadeias de provedores a partir da configuração (ordem = prioridade). */
export function buildRegistries({ config, logger, store = null, onCall, fetchImpl }) {
  const cnpjFactories = {
    brasilapi: () => createBrasilApiCnpjProvider({ timeoutMs: config.cnpj.timeoutMs, fetchImpl }),
    serpro: () => createSerproCnpjProvider({ ...config.cnpj.serpro, timeoutMs: config.cnpj.timeoutMs, fetchImpl }),
  };
  const cepFactories = {
    viacep: () => createViaCepProvider({ timeoutMs: config.cep.timeoutMs, fetchImpl }),
    brasilapi: () => createBrasilApiCepProvider({ timeoutMs: config.cep.timeoutMs, fetchImpl }),
  };
  const pick = (names, factories, label) => names.map((n) => {
    if (!factories[n]) throw new Error(`Provedor de ${label} desconhecido: ${n}`);
    return factories[n]();
  });
  return {
    cnpj: new ProviderChain({
      kind: 'cnpj', providers: pick(config.cnpj.providers, cnpjFactories, 'CNPJ'),
      memory: new MemoryCache({ maxItems: 5000 }), store, ttlSeconds: config.cnpj.cacheTtlSeconds, logger, onCall,
    }),
    cep: new ProviderChain({
      kind: 'cep', providers: pick(config.cep.providers, cepFactories, 'CEP'),
      memory: new MemoryCache({ maxItems: 20000 }), store, ttlSeconds: config.cep.cacheTtlSeconds, logger, onCall,
    }),
  };
}
