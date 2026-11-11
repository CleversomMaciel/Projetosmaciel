import { requestJson } from '../../lib/http.js';
import { ProviderError, ProviderNotFound } from '../../lib/errors.js';

const clean = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

/** BrasilAPI CEP v1 — agrega vários serviços de CEP. Não devolve código IBGE. */
export function createBrasilApiCepProvider({ baseUrl = 'https://brasilapi.com.br', timeoutMs, fetchImpl } = {}) {
  return {
    name: 'brasilapi',
    async lookup(cep) {
      const { status, json } = await requestJson(`${baseUrl}/api/cep/v1/${cep}`, { timeoutMs, fetchImpl });
      if (status === 404) throw new ProviderNotFound();
      if (status !== 200 || !json) throw new ProviderError(`HTTP ${status}`, { status });
      return {
        cep,
        street: clean(json.street),
        district: clean(json.neighborhood),
        city: clean(json.city),
        uf: clean(json.state),
        ibgeCode: null,
      };
    },
  };
}
