import { requestJson } from '../../lib/http.js';
import { ProviderError, ProviderNotFound } from '../../lib/errors.js';

const clean = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

/** ViaCEP — https://viacep.com.br/ — gratuito, sem chave; devolve o código IBGE do município. */
export function createViaCepProvider({ baseUrl = 'https://viacep.com.br', timeoutMs, fetchImpl } = {}) {
  return {
    name: 'viacep',
    async lookup(cep) {
      const { status, json } = await requestJson(`${baseUrl}/ws/${cep}/json/`, { timeoutMs, fetchImpl });
      if (status !== 200 || !json) throw new ProviderError(`HTTP ${status}`, { status });
      if (json.erro === true || json.erro === 'true') throw new ProviderNotFound();
      return {
        cep,
        street: clean(json.logradouro),
        district: clean(json.bairro),
        city: clean(json.localidade),
        uf: clean(json.uf),
        ibgeCode: clean(json.ibge),
      };
    },
  };
}
