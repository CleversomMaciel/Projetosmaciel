import { $, api, esc, getClient, getProfile, mountChrome, requireSession, setBusy, showNotice } from './core.js';
import { bindCep } from './endereco.js';

mountChrome();
const aviso = $('#aviso');

function termsBlock(docType) {
  return `
    <h2 class="font-semibold">Termos e privacidade</h2>
    <p class="notice-warn">Os documentos definitivos estão em revisão jurídica. Esta é a versão preliminar de teste: <span data-versao></span>.</p>
    <label class="flex items-start gap-3 text-sm">
      <input class="mt-1 accent-mata-600" type="checkbox" data-aceite="${docType}" required>
      <span>Li e aceito os Termos de Uso e a Política de Privacidade do Bico BR.</span>
    </label>`;
}

async function recordConsents(sb, userId, docTypes, version) {
  const rows = docTypes.map((doc_type) => ({ user_id: userId, doc_type, doc_version: version, user_agent: navigator.userAgent.slice(0, 300) }));
  const { error } = await sb.from('consents').upsert(rows, { onConflict: 'user_id,doc_type,doc_version', ignoreDuplicates: true });
  if (error) throw new Error('Não foi possível registrar o aceite dos termos.');
}

(async () => {
  const session = await requireSession();
  const { sb } = await getClient();
  const profile = await getProfile();
  $('#carregando').hidden = true;
  if (!profile) return showNotice(aviso, 'error', 'Não encontramos seu perfil. Saia e entre novamente.');
  if (profile.onboarded_at) return location.replace('/painel');

  const { data: setting } = await sb.from('platform_settings').select('value').eq('key', 'contract_terms_version').maybeSingle();
  const version = typeof setting?.value === 'string' ? setting.value : 'rascunho-0';

  // ------------------------------------------------------------ empresa
  if (profile.account_type === 'company') {
    const form = $('#form-empresa');
    form.hidden = false;
    $('[data-termos]', form).innerHTML = termsBlock('termos_empresa');
    $('[data-versao]', form).textContent = version;
    const address = bindCep('');
    const status = $('#cnpj-status');
    let lookedUp = null;

    const lookup = async () => {
      const cnpj = $('#cnpj').value.trim();
      if (cnpj.replace(/[^0-9a-z]/gi, '').length !== 14) { status.textContent = 'O CNPJ tem 14 caracteres.'; return; }
      status.textContent = 'Consultando CNPJ…';
      $('#cnpj-dados').hidden = true;
      try {
        const r = await api(`/cnpj/${encodeURIComponent(cnpj)}`);
        if (!r.available || !r.found) {
          lookedUp = null;
          $('#manual').hidden = false;
          status.textContent = r.message;
          return;
        }
        lookedUp = r.company;
        $('#manual').hidden = true;
        const c = r.company;
        const rows = [
          ['Razão social', c.legalName], ['Nome fantasia', c.tradeName], ['Situação cadastral', c.registryStatus],
          ['Abertura', c.openedAt ? new Date(`${c.openedAt}T12:00:00`).toLocaleDateString('pt-BR') : null],
          ['Natureza jurídica', c.legalNature], ['Porte', c.size],
          ['CNAE principal', c.mainCnae ? `${c.mainCnae.code} — ${c.mainCnae.description ?? ''}` : null],
        ].filter(([, v]) => v);
        $('#cnpj-dados').innerHTML = rows.map(([k, v]) => `<div><dt class="text-xs text-tinta-500">${esc(k)}</dt><dd class="font-medium">${esc(v)}</dd></div>`).join('')
          + `<p class="text-xs text-tinta-500 sm:col-span-2">${esc(r.notice)}</p>`;
        $('#cnpj-dados').hidden = false;
        if (!$('#displayName').value) $('#displayName').value = c.tradeName || c.legalName || '';
        if (c.address?.cep && !$('#cep').value) {
          $('#cep').value = c.address.cep;
          $('#street').value = c.address.street ?? ''; $('#number').value = c.address.number ?? '';
          $('#complement').value = c.address.complement ?? ''; $('#district').value = c.address.district ?? '';
          $('#city').value = c.address.city ?? ''; $('#uf').value = c.address.uf ?? ''; $('#ibge').value = c.address.ibgeCode ?? '';
          $('#cep').dispatchEvent(new Event('input'));
        }
        status.textContent = 'Dados encontrados. Confira e complete o que faltar.';
      } catch (err) {
        lookedUp = null;
        if (err.status === 400) { status.textContent = err.message; return; }
        $('#manual').hidden = false;
        status.textContent = err.status === 429 ? 'Muitas consultas. Aguarde um minuto ou preencha manualmente.' : 'Consulta indisponível. Preencha os dados manualmente.';
      }
    };
    $('#buscar-cnpj').addEventListener('click', lookup);
    $('#cnpj').addEventListener('change', lookup);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const problem = address.validate()
        || (!$('#displayName').value.trim() && 'Informe o nome de exibição.')
        || (!$('[data-aceite]', form).checked && 'É necessário aceitar os termos para continuar.');
      if (problem) return showNotice(aviso, 'error', problem);
      const btn = ev.submitter;
      setBusy(btn, true, 'Salvando…');
      try {
        await recordConsents(sb, session.user.id, ['termos_empresa', 'privacidade'], version);
        await api('/companies', { method: 'POST', body: {
          personType: 'pj', cnpj: $('#cnpj').value, legalName: lookedUp ? undefined : $('#legalName').value,
          displayName: $('#displayName').value, segment: $('#segment').value, website: $('#website').value || undefined,
          description: $('#description').value, address: address.read(), addressConfirmed: true,
        } });
        location.replace('/painel');
      } catch (err) {
        setBusy(btn, false);
        showNotice(aviso, 'error', err.message);
        aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    return;
  }

  // ------------------------------------------------------------ freelancer
  const form = $('#form-freelancer');
  form.hidden = false;
  $('[data-termos]', form).innerHTML = termsBlock('termos_freelancer');
  $('[data-versao]', form).textContent = version;
  const address = bindCep('f-');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const problem = (!$('#headline').value.trim() && 'Informe seu título profissional.') || address.validate()
      || (!$('[data-aceite]', form).checked && 'É necessário aceitar os termos para continuar.');
    if (problem) return showNotice(aviso, 'error', problem);
    const btn = ev.submitter;
    setBusy(btn, true, 'Salvando…');
    try {
      const a = address.read();
      const uid = session.user.id;
      await recordConsents(sb, uid, ['termos_freelancer', 'privacidade'], version);
      const steps = await Promise.all([
        sb.from('freelancer_profiles').update({ headline: $('#headline').value.trim(), bio: $('#bio').value.trim() || null, is_public: $('#perfil-publico').checked }).eq('user_id', uid),
        sb.from('profile_private').update({
          cep: a.cep.replace(/\D/g, ''), street: a.street, number: a.number || null, complement: a.complement || null,
          district: a.district || null, city: a.city, uf: a.uf, ibge_code: a.ibgeCode, address_confirmed_at: new Date().toISOString(),
        }).eq('user_id', uid),
      ]);
      if (steps.some((s) => s.error)) throw new Error('Não foi possível salvar. Confira os campos e tente de novo.');
      const { error } = await sb.from('profiles').update({ city: a.city, uf: a.uf, onboarded_at: new Date().toISOString() }).eq('id', uid);
      if (error) throw new Error('Não foi possível concluir o cadastro.');
      location.replace('/painel');
    } catch (err) {
      setBusy(btn, false);
      showNotice(aviso, 'error', err.message);
      aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();
