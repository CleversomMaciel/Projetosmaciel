import { ProviderError, ProviderNotFound } from '../lib/errors.js';

/**
 * Consulta com cache em dois níveis e cadeia de provedores com alternativa (fallback).
 * O restante do sistema fala apenas com esta classe: trocar de fornecedor é mudar a lista.
 *
 * - provider: { name, lookup(key) -> dado normalizado | lança ProviderNotFound | ProviderError }
 * - store (opcional): cache persistente { get(kind, key), set(kind, key, provider, payload, ttl) }
 * - disjuntor simples: após `breakerThreshold` falhas seguidas o provedor é pulado por `breakerCooldownMs`
 */
export class ProviderChain {
  constructor({
    kind, providers, memory, store = null, ttlSeconds, logger, onCall = () => {},
    breakerThreshold = 3, breakerCooldownMs = 60_000, now = () => Date.now(),
  }) {
    if (!providers?.length) throw new Error(`Nenhum provedor configurado para ${kind}`);
    Object.assign(this, { kind, providers, memory, store, ttlSeconds, logger, onCall, breakerThreshold, breakerCooldownMs, now });
    this.health = new Map(providers.map((p) => [p.name, { failures: 0, openUntil: 0 }]));
  }

  /** @returns {{status:'ok', data, source:'cache'|'provider'} | {status:'not_found'} | {status:'unavailable'}} */
  async lookup(key) {
    const cached = this.memory.get(`${this.kind}:${key}`);
    if (cached) {
      this.onCall({ service: this.kind, provider: cached.provider, outcome: 'cache_hit' });
      return { status: 'ok', data: cached, source: 'cache' };
    }
    if (this.store) {
      try {
        const persisted = await this.store.get(this.kind, key);
        if (persisted) {
          this.memory.set(`${this.kind}:${key}`, persisted, Math.min(this.ttlSeconds, 3600));
          this.onCall({ service: this.kind, provider: persisted.provider, outcome: 'cache_hit' });
          return { status: 'ok', data: persisted, source: 'cache' };
        }
      } catch (err) {
        this.logger.warn('cache persistente indisponível', { kind: this.kind, err });
      }
    }

    let notFound = 0;
    let attempted = 0;
    for (const provider of this.providers) {
      const health = this.health.get(provider.name);
      if (health.openUntil > this.now()) continue;
      attempted += 1;
      const started = this.now();
      try {
        const data = { ...(await provider.lookup(key)), provider: provider.name, fetchedAt: new Date(this.now()).toISOString() };
        health.failures = 0;
        this.onCall({ service: this.kind, provider: provider.name, outcome: 'ok', durationMs: this.now() - started });
        this.memory.set(`${this.kind}:${key}`, data, this.ttlSeconds);
        if (this.store) {
          this.store.set(this.kind, key, provider.name, data, this.ttlSeconds)
            .catch((err) => this.logger.warn('falha ao gravar cache persistente', { kind: this.kind, err }));
        }
        return { status: 'ok', data, source: 'provider' };
      } catch (err) {
        const durationMs = this.now() - started;
        if (err instanceof ProviderNotFound) {
          health.failures = 0;
          notFound += 1;
          this.onCall({ service: this.kind, provider: provider.name, outcome: 'not_found', durationMs });
          continue; // outro provedor pode ter base mais atual
        }
        health.failures += 1;
        if (health.failures >= this.breakerThreshold) health.openUntil = this.now() + this.breakerCooldownMs;
        const kind = err instanceof ProviderError ? err.kind : 'error';
        this.onCall({ service: this.kind, provider: provider.name, outcome: kind, durationMs, httpStatus: err.status, error: err.message });
        this.logger.warn('provedor externo falhou', { service: this.kind, provider: provider.name, kind, err });
      }
    }
    // "não encontrado" só é conclusivo se todo provedor consultado respondeu isso
    if (attempted > 0 && notFound === attempted) return { status: 'not_found' };
    return { status: 'unavailable' };
  }
}
