import { $, getClient, mountChrome, parseBrlToCents, requireSession, setBusy, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');

(async () => {
  const session = await requireSession();
  const { sb } = await getClient();
  const { data: company } = await sb.from('companies').select('id, city, uf').eq('owner_id', session.user.id).maybeSingle();
  if (!company) return showNotice(aviso, 'warn', 'Para publicar é preciso ter um perfil empresarial.');
  const form = $('#form');
  form.hidden = false;
  const { data: cats } = await sb.from('categories').select('id, name').order('sort_order');
  for (const c of cats ?? []) $('#category').add(new Option(c.name, c.id));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const smin = parseBrlToCents($('#smin').value);
    const smax = parseBrlToCents($('#smax').value);
    const applyUrl = $('#applyurl').value.trim();
    const problem = ($('#title').value.trim().length < 5 && 'Informe o cargo.')
      || ($('#description').value.trim().length < 30 && 'Descreva a vaga com pelo menos 30 caracteres.')
      || (!$('#category').value && 'Selecione a área.')
      || (smin && smax && smax < smin && 'A remuneração máxima deve ser maior que a mínima.')
      || (applyUrl && !/^https:\/\//i.test(applyUrl) && 'O link de candidatura precisa começar com https://');
    if (problem) return showNotice(aviso, 'error', problem);
    setBusy(ev.submitter, true, 'Publicando…');
    const { error } = await sb.from('jobs').insert({
      company_id: company.id, created_by: session.user.id, title: $('#title').value.trim(),
      description: $('#description').value.trim(), category_id: $('#category').value,
      requirements: $('#requirements').value.trim() || null, benefits: $('#benefits').value.trim() || null,
      contract_type: $('#contract').value, experience_level: $('#level').value || null,
      salary_min_cents: smin, salary_max_cents: smax, workload: $('#workload').value.trim() || null,
      application_deadline: $('#deadline').value || null, selection_process: $('#process').value.trim() || null,
      apply_mode: applyUrl ? 'external' : 'internal', apply_url: applyUrl || null,
      company_city: company.city, company_uf: company.uf, status: 'open',
    });
    if (error) { setBusy(ev.submitter, false); return showNotice(aviso, 'error', 'Não foi possível publicar a vaga. Confira os campos.'); }
    location.href = '/vagas';
  });
})();
