import { $, mountChrome, warnIfUnconfigured } from './core.js';
import { JOB_SELECT, getViewer, mountAdSlot, renderJob } from './cards.js';
import { createFeed, fillCategories } from './listagem.js';

mountChrome();
const params = new URLSearchParams(location.search);
$('#q').value = params.get('q') ?? '';
$('#contrato').value = ['clt', 'pj', 'estagio', 'temporario', 'freelancer', 'projeto'].includes(params.get('contrato')) ? params.get('contrato') : '';

(async () => {
  if (!(await warnIfUnconfigured($('#aviso')))) return;
  const [categories, viewer] = await Promise.all([fillCategories($('#categoria'), params.get('categoria')), getViewer()]);
  const cat = () => categories.find((c) => c.slug === $('#categoria').value);
  const feed = createFeed({
    table: 'jobs', kind: 'job', select: JOB_SELECT, viewer, renderItem: renderJob,
    empty: ['Nenhuma vaga remota aberta com esses filtros', 'Novas vagas entram todos os dias. Tente outra área.'],
    adCategory: () => cat()?.id ?? null,
    applyFilters(query) {
      let q = query.eq('work_mode', 'remote'); // nunca misturar presencial/híbrido
      if (cat()) q = q.eq('category_id', cat().id);
      if ($('#contrato').value) q = q.eq('contract_type', $('#contrato').value);
      if ($('#q').value.trim()) q = q.textSearch('search', $('#q').value.trim(), { config: 'portuguese', type: 'websearch' });
      return q;
    },
  });
  const refresh = () => { mountAdSlot($('#ad-lateral'), 'sidebar', cat()?.id ?? null, 2); feed.reload(); };
  $('#filtros').addEventListener('submit', (ev) => { ev.preventDefault(); refresh(); });
  for (const id of ['#categoria', '#contrato']) $(id).addEventListener('change', refresh);
  refresh();
})();
