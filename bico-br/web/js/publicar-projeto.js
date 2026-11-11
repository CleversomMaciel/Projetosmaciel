import { $, getClient, mountChrome, parseBrlToCents, requireSession, setBusy, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');

(async () => {
  const session = await requireSession();
  const { sb } = await getClient();
  const { data: company } = await sb.from('companies').select('id').eq('owner_id', session.user.id).maybeSingle();
  if (!company) { showNotice(aviso, 'warn', 'Para publicar é preciso ter um perfil empresarial. Complete o cadastro da empresa primeiro.'); return; }
  const form = $('#form');
  form.hidden = false;

  const { data: cats } = await sb.from('categories').select('id, name, subcategories(id, name, sort_order)').order('sort_order');
  for (const c of cats ?? []) $('#category').add(new Option(c.name, c.id));
  $('#category').addEventListener('change', () => {
    const subs = (cats ?? []).find((c) => c.id === $('#category').value)?.subcategories ?? [];
    $('#subcategory').replaceChildren(new Option('—', ''), ...subs.sort((a, b) => a.sort_order - b.sort_order).map((s) => new Option(s.name, s.id)));
  });

  const syncKind = () => {
    const quick = $('input[name="kind"]:checked').value === 'quick';
    $('#campo-max').hidden = quick;
    $('#label-min').textContent = quick ? 'Preço fechado (R$)' : 'Orçamento mínimo (R$)';
    $('#deadline').max = quick ? 15 : 730;
  };
  form.addEventListener('change', (ev) => { if (ev.target.name === 'kind') syncKind(); });
  syncKind();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const quick = $('input[name="kind"]:checked').value === 'quick';
    const min = parseBrlToCents($('#min').value);
    const max = quick ? null : parseBrlToCents($('#max').value);
    const deadline = Number.parseInt($('#deadline').value, 10) || null;
    const problem = ($('#title').value.trim().length < 8 && 'O título precisa ter pelo menos 8 caracteres.')
      || ($('#description').value.trim().length < 30 && 'Descreva o projeto com pelo menos 30 caracteres.')
      || (!$('#category').value && 'Selecione a área.')
      || (quick && (!min || !deadline || deadline > 15) && 'Bico Rápido exige preço fechado e prazo de até 15 dias.')
      || (min && max && max < min && 'O orçamento máximo deve ser maior que o mínimo.');
    if (problem) return showNotice(aviso, 'error', problem);

    setBusy(ev.submitter, true, 'Salvando…');
    const { data, error } = await sb.from('projects').insert({
      company_id: company.id, created_by: session.user.id, kind: quick ? 'quick' : 'project',
      title: $('#title').value.trim(), description: $('#description').value.trim(),
      deliverables: $('#deliverables').value.trim() || null,
      category_id: $('#category').value, subcategory_id: $('#subcategory').value || null,
      budget_type: quick ? 'fixed' : (min || max ? 'range' : 'open'), budget_min_cents: min, budget_max_cents: max,
      deadline_days: deadline, experience_level: $('#level').value || null,
      professionals_wanted: Number.parseInt($('#wanted').value, 10) || 1,
      status: ev.submitter.dataset.status === 'draft' ? 'draft' : 'open',
    }).select('id').single();
    if (error) { setBusy(ev.submitter, false); return showNotice(aviso, 'error', 'Não foi possível salvar o projeto. Confira os campos.'); }
    location.href = ev.submitter.dataset.status === 'draft' ? '/painel' : `/projeto?id=${data.id}`;
  });
})();
