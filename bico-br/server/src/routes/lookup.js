import { Router } from 'express';
import { badRequest, notFound } from '../lib/errors.js';
import { isValidCnpj, normalizeCnpj } from '../validators/cnpj.js';
import { isValidCep, normalizeCep } from '../validators/cep.js';
import { limiter } from '../middleware/rateLimit.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export function lookupRoutes({ registries, auth }) {
  const router = Router();

  // CEP: público (usado em formulários), protegido por limite de requisições.
  router.get('/cep/:cep', limiter({ max: 30 }), wrap(async (req, res) => {
    const cep = normalizeCep(req.params.cep);
    if (!isValidCep(cep)) throw badRequest('CEP_INVALID', 'CEP inválido. Informe 8 dígitos.');
    const result = await registries.cep.lookup(cep);
    if (result.status === 'not_found') throw notFound('CEP_NOT_FOUND', 'CEP não encontrado. Preencha o endereço manualmente.');
    if (result.status === 'unavailable') {
      // serviço externo fora do ar NÃO bloqueia o cadastro: o formulário segue em modo manual
      return res.status(200).json({ available: false, manual: true, message: 'Consulta de CEP indisponível no momento. Preencha o endereço manualmente.' });
    }
    const { cep: c, street, district, city, uf, ibgeCode, provider } = result.data;
    res.set('cache-control', 'private, max-age=3600');
    return res.json({ available: true, address: { cep: c, street, district, city, uf, ibgeCode }, source: provider });
  }));

  // CNPJ: exige login (evita que o endpoint vire proxy aberto de consulta cadastral).
  router.get('/cnpj/:cnpj', auth, limiter({ max: 10, byUser: true }), wrap(async (req, res) => {
    const cnpj = normalizeCnpj(req.params.cnpj);
    if (!isValidCnpj(cnpj)) throw badRequest('CNPJ_INVALID', 'CNPJ inválido. Confira os caracteres e os dígitos verificadores.');
    const result = await registries.cnpj.lookup(cnpj);
    if (result.status === 'not_found') {
      return res.status(200).json({ available: true, found: false, manual: true, message: 'CNPJ não localizado na base consultada. Você pode preencher os dados manualmente.' });
    }
    if (result.status === 'unavailable') {
      return res.status(200).json({ available: false, manual: true, message: 'Consulta de CNPJ indisponível no momento. Preencha os dados manualmente.' });
    }
    const { provider, fetchedAt, ...company } = result.data;
    return res.json({
      available: true, found: true, company, source: provider, checkedAt: fetchedAt,
      notice: 'Dados cadastrais públicos. A consulta não atesta idoneidade, solvência ou confiabilidade da empresa.',
    });
  }));

  return router;
}
