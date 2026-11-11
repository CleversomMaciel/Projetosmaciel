import { $, api } from './core.js';

/**
 * Liga o preenchimento automático por CEP a um grupo de campos.
 * prefix = '' (empresa) ou 'f-' (freelancer). O usuário sempre pode corrigir os campos,
 * e a falha do serviço de CEP nunca impede o cadastro.
 */
export function bindCep(prefix = '') {
  const f = (id) => $(`#${prefix}${id}`);
  const status = f('cep-status');
  let last = '';

  f('cep').addEventListener('input', async () => {
    const digits = f('cep').value.replace(/\D/g, '').slice(0, 8);
    f('cep').value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    if (digits.length !== 8 || digits === last) return;
    last = digits;
    status.textContent = 'Buscando endereço…';
    try {
      const r = await api(`/cep/${digits}`);
      if (!r.available) { status.textContent = r.message; return; }
      f('street').value = r.address.street ?? '';
      f('district').value = r.address.district ?? '';
      f('city').value = r.address.city ?? '';
      f('uf').value = r.address.uf ?? '';
      f('ibge').value = r.address.ibgeCode ?? '';
      f('confirma-endereco').checked = false; // endereço novo exige nova confirmação
      status.textContent = 'Endereço preenchido. Confira e complete o número.';
      (r.address.street ? f('number') : f('street')).focus();
    } catch (err) {
      status.textContent = err.status === 404 ? 'CEP não encontrado. Preencha o endereço manualmente.'
        : err.status === 429 ? 'Muitas consultas. Preencha manualmente ou tente em instantes.'
        : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.';
    }
  });

  return {
    read() {
      return {
        cep: f('cep').value, street: f('street').value.trim(), number: f('number').value.trim(),
        complement: f('complement').value.trim(), district: f('district').value.trim(),
        city: f('city').value.trim(), uf: f('uf').value.trim().toUpperCase(), ibgeCode: f('ibge').value || null,
      };
    },
    confirmed: () => f('confirma-endereco').checked,
    validate() {
      const a = this.read();
      if (a.cep.replace(/\D/g, '').length !== 8) return 'Informe um CEP com 8 dígitos.';
      if (!a.street || !a.city) return 'Informe logradouro e cidade.';
      if (!/^[A-Z]{2}$/.test(a.uf)) return 'Informe a UF com 2 letras.';
      if (!this.confirmed()) return 'Confirme que o endereço está correto.';
      return null;
    },
  };
}
