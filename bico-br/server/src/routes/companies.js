import crypto from 'node:crypto';
import { Router } from 'express';
import { badRequest, conflict, forbidden } from '../lib/errors.js';
import { isValidCnpj, maskCnpj, normalizeCnpj } from '../validators/cnpj.js';
import { isValidCpf, normalizeCpf } from '../validators/cpf.js';
import { isValidCep, normalizeCep } from '../validators/cep.js';
import { isValidUf } from '../validators/uf.js';
import { limiter } from '../middleware/rateLimit.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function slugify(name) {
  const base = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'empresa';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

export function companyRoutes({ store, registries, auth, config }) {
  const router = Router();

  /**
   * Cria o perfil empresarial. Os dados cadastrais (razão social, situação, CNAE...) vêm da
   * consulta feita PELO SERVIDOR — o que o navegador envia nesses campos é ignorado quando a
   * consulta está disponível. O usuário informa/complementa contato, descrição e endereço.
   */
  router.post('/companies', auth, limiter({ max: 10, byUser: true }), wrap(async (req, res) => {
    const b = req.body || {};
    const profile = await store.getProfile(req.user.id);
    if (!profile || profile.account_type !== 'company') throw forbidden('Apenas contas do tipo empresa podem criar perfil empresarial.');
    if (await store.countCompaniesByOwner(req.user.id) > 0) throw conflict('COMPANY_EXISTS', 'Esta conta já possui um perfil empresarial.');

    const personType = b.personType === 'pf' ? 'pf' : 'pj';
    if (personType === 'pf' && !config.features.allowPfContractors) {
      throw forbidden('O cadastro de contratante pessoa física ainda não está habilitado.');
    }
    if (b.addressConfirmed !== true) throw badRequest('ADDRESS_NOT_CONFIRMED', 'Confirme o endereço antes de salvar.');

    const a = b.address || {};
    const cep = normalizeCep(a.cep);
    if (!isValidCep(cep)) throw badRequest('CEP_INVALID', 'CEP inválido.');
    if (!isValidUf(a.uf)) throw badRequest('UF_INVALID', 'UF inválida.');
    const city = text(a.city, 120);
    const street = text(a.street, 200);
    if (!city || !street) throw badRequest('ADDRESS_INCOMPLETE', 'Informe logradouro e cidade.');
    const ibge = /^[0-9]{7}$/.test(String(a.ibgeCode ?? '')) ? String(a.ibgeCode) : null;
    const website = text(b.website, 300);
    if (website && !/^https?:\/\//i.test(website)) throw badRequest('WEBSITE_INVALID', 'O site deve começar com http:// ou https://');

    const privateData = {
      cep, street, number: text(a.number, 20), complement: text(a.complement, 120), district: text(a.district, 120),
      city, uf: a.uf.toUpperCase(), ibge_code: ibge, address_confirmed_at: new Date().toISOString(),
      contact_phone: text(b.contactPhone, 20), contact_email: text(b.contactEmail, 200),
    };
    let displayName = text(b.displayName, 160);
    let cnpjMasked = null; let registryStatus = null; let registryCheckedAt = null;

    if (personType === 'pj') {
      const cnpj = normalizeCnpj(b.cnpj);
      if (!isValidCnpj(cnpj)) throw badRequest('CNPJ_INVALID', 'CNPJ inválido.');
      if (await store.companyExistsByCnpj(cnpj)) throw conflict('CNPJ_IN_USE', 'Já existe uma empresa cadastrada com este CNPJ. Se for a sua, fale com o suporte.');
      const lookup = await registries.cnpj.lookup(cnpj);
      const reg = lookup.status === 'ok' ? lookup.data : null;
      Object.assign(privateData, {
        cnpj,
        legal_name: reg?.legalName ?? text(b.legalName, 200),
        trade_name: reg?.tradeName ?? text(b.tradeName, 200),
        opened_at: /^\d{4}-\d{2}-\d{2}$/.test(reg?.openedAt ?? '') ? reg.openedAt : null,
        legal_nature: reg?.legalNature ?? null,
        company_size: reg?.size ?? null,
        main_cnae: reg?.mainCnae ?? null,
        secondary_cnaes: reg?.secondaryCnaes ?? [],
        registry_provider: reg?.provider ?? null,
        registry_phone: reg?.phone ?? null,
        registry_email: reg?.email ?? null,
      });
      cnpjMasked = maskCnpj(cnpj);
      registryStatus = reg?.registryStatus ?? null; // nulo = não consultado (dados informados manualmente)
      registryCheckedAt = reg?.fetchedAt ?? null;
      displayName = displayName || privateData.trade_name || privateData.legal_name;
    } else {
      const cpf = normalizeCpf(b.cpf);
      if (!isValidCpf(cpf)) throw badRequest('CPF_INVALID', 'CPF inválido.');
      privateData.cpf = cpf;
    }
    if (!displayName || displayName.length < 2) throw badRequest('NAME_REQUIRED', 'Informe o nome de exibição da empresa.');

    const created = await store.createCompany({
      company: {
        owner_id: req.user.id, person_type: personType, display_name: displayName, slug: slugify(displayName),
        description: text(b.description, 5000), segment: text(b.segment, 120), website,
        city, uf: a.uf.toUpperCase(), cnpj_masked: cnpjMasked,
        registry_status: registryStatus, registry_checked_at: registryCheckedAt,
      },
      privateData,
    });
    await store.markOnboarded(req.user.id, { city, uf: a.uf.toUpperCase() });
    res.status(201).json({ id: created.id, slug: created.slug, registryChecked: Boolean(registryCheckedAt) });
  }));

  return router;
}
