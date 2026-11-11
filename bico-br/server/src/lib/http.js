import { ProviderError } from './errors.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET/POST JSON com timeout e retry controlado.
 * Repete apenas falhas transitórias (rede, timeout, 5xx). 429 NÃO é repetido:
 * insistir em um provedor que pediu para reduzir o ritmo só piora o bloqueio.
 */
export async function requestJson(url, {
  method = 'GET', headers = {}, body, timeoutMs = 5000, retries = 1, retryDelayMs = 250,
  fetchImpl = globalThis.fetch,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(retryDelayMs * 2 ** (attempt - 1));
    try {
      const res = await fetchImpl(url, {
        method, body,
        headers: { accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429) throw new ProviderError('rate limited', { kind: 'rate_limited', status: 429 });
      if (res.status >= 500) {
        lastError = new ProviderError(`HTTP ${res.status}`, { status: res.status });
        continue;
      }
      const text = await res.text();
      let json = null;
      if (text) {
        try { json = JSON.parse(text); } catch { json = null; }
      }
      return { status: res.status, json };
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'rate_limited') throw err;
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      lastError = err instanceof ProviderError
        ? err
        : new ProviderError(isTimeout ? 'timeout' : `falha de rede: ${err?.message}`, { kind: isTimeout ? 'timeout' : 'error' });
    }
  }
  throw lastError;
}
