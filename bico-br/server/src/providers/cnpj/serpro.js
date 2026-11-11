import { requestJson } from '../../lib/http.js';
import { ProviderError, ProviderNotFound } from '../../lib/errors.js';

const clean = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

/**
 * SERPRO Consulta CNPJ (fonte oficial, PAGA, exige contrato na Loja Serpro).
 * https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnpj/
 *
 * ATENÇÃO: este provedor foi escrito a partir da documentação e NÃO foi testado contra o
 * ambiente real (exige credenciais contratadas). Só entra na cadeia se CNPJ_PROVIDERS
 * incluir "serpro". Antes de ativar em produção: validar o mapeamento de campos no
 * ambiente de demonstração (trial) do Serpro e ajustar SERPRO_CNPJ_PATH à versão contratada.
 * Usa a consulta "básica": não traz quadro societário.
 */
export function createSerproCnpjProvider({ consumerKey, consumerSecret, baseUrl, apiPath, timeoutMs, fetchImpl, now = () => Date.now() }) {
  let token = null;
  let tokenExpiresAt = 0;

  async function getToken() {
    if (token && tokenExpiresAt > now() + 30_000) return token;
    const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const { status, json } = await requestJson(`${baseUrl}/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
      timeoutMs, fetchImpl, retries: 0,
    });
    if (status !== 200 || !json?.access_token) throw new ProviderError(`token SERPRO: HTTP ${status}`, { status });
    token = json.access_token;
    tokenExpiresAt = now() + (Number(json.expires_in) || 3000) * 1000;
    return token;
  }

  return {
    name: 'serpro',
    async lookup(cnpj) {
      const bearer = await getToken();
      const { status, json } = await requestJson(`${baseUrl}${apiPath}/${cnpj}`, {
        headers: { authorization: `Bearer ${bearer}` }, timeoutMs, fetchImpl,
      });
      if (status === 404) throw new ProviderNotFound();
      if (status === 401) { token = null; throw new ProviderError('token SERPRO recusado', { status }); }
      if (status !== 200 || !json) throw new ProviderError(`HTTP ${status}`, { status });
      const e = json.endereco || {};
      const tel = (json.telefones || [])[0];
      const street = [clean(e.tipoLogradouro), clean(e.logradouro)].filter(Boolean).join(' ');
      return {
        cnpj,
        legalName: clean(json.nomeEmpresarial),
        tradeName: clean(json.nomeFantasia),
        registryStatus: clean(json.situacaoCadastral?.descricao ?? json.situacaoCadastral?.codigo),
        openedAt: clean(json.dataAbertura),
        legalNature: clean(json.naturezaJuridica?.descricao),
        size: clean(json.porte),
        mainCnae: json.cnaePrincipal?.codigo
          ? { code: String(json.cnaePrincipal.codigo), description: clean(json.cnaePrincipal.descricao) } : null,
        secondaryCnaes: (json.cnaeSecundarias || [])
          .filter((c) => c && c.codigo)
          .map((c) => ({ code: String(c.codigo), description: clean(c.descricao) })),
        address: {
          cep: clean(e.cep), street: street || null, number: clean(e.numero), complement: clean(e.complemento),
          district: clean(e.bairro), city: clean(e.municipio?.descricao), uf: clean(e.uf),
          ibgeCode: e.municipio?.codigo ? String(e.municipio.codigo) : null,
        },
        phone: tel ? `${tel.ddd ?? ''}${tel.numero ?? ''}` || null : null,
        email: clean(json.correioEletronico)?.toLowerCase() ?? null,
      };
    },
  };
}
