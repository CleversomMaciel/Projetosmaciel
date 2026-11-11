import { requestJson } from '../../lib/http.js';
import { ProviderError, ProviderNotFound } from '../../lib/errors.js';
import { normalizeCep } from '../../validators/cep.js';

const clean = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

/**
 * BrasilAPI — https://brasilapi.com.br/docs#tag/CNPJ
 * Gratuita, sem chave, sem SLA. Dados vêm da base pública da Receita (atualização periódica,
 * não em tempo real). Boa para começar; não deve ser a única fonte em escala.
 * O quadro societário (qsa) devolvido pela API é DESCARTADO: não é necessário ao cadastro.
 */
export function createBrasilApiCnpjProvider({ baseUrl = 'https://brasilapi.com.br', timeoutMs, fetchImpl } = {}) {
  return {
    name: 'brasilapi',
    async lookup(cnpj) {
      const { status, json } = await requestJson(`${baseUrl}/api/cnpj/v1/${cnpj}`, { timeoutMs, fetchImpl });
      if (status === 404) throw new ProviderNotFound();
      // 400 = a API não reconheceu o formato (ex.: CNPJ alfanumérico ainda não suportado):
      // tratamos como falha do provedor para que o próximo da cadeia seja tentado.
      if (status !== 200 || !json) throw new ProviderError(`HTTP ${status}`, { status });
      const street = [clean(json.descricao_tipo_de_logradouro), clean(json.logradouro)].filter(Boolean).join(' ');
      return {
        cnpj,
        legalName: clean(json.razao_social),
        tradeName: clean(json.nome_fantasia),
        registryStatus: clean(json.descricao_situacao_cadastral),
        openedAt: clean(json.data_inicio_atividade),
        legalNature: clean(json.natureza_juridica),
        size: clean(json.porte),
        mainCnae: json.cnae_fiscal ? { code: String(json.cnae_fiscal), description: clean(json.cnae_fiscal_descricao) } : null,
        secondaryCnaes: (json.cnaes_secundarios || [])
          .filter((c) => c && c.codigo)
          .map((c) => ({ code: String(c.codigo), description: clean(c.descricao) })),
        address: {
          cep: clean(json.cep) ? normalizeCep(String(json.cep).padStart(8, '0')) : null,
          street: street || null,
          number: clean(json.numero),
          complement: clean(json.complemento),
          district: clean(json.bairro),
          city: clean(json.municipio),
          uf: clean(json.uf),
          ibgeCode: json.codigo_municipio_ibge ? String(json.codigo_municipio_ibge) : null,
        },
        phone: clean(json.ddd_telefone_1),
        email: clean(json.email)?.toLowerCase() ?? null,
      };
    },
  };
}
