import { $, mountChrome, warnIfUnconfigured } from './core.js';
import { PROJECT_SELECT, getViewer, mountAdSlot, renderProject } from './cards.js';
import { createFeed, fillCategories } from './listagem.js';

mountChrome();
const params = new URLSearchParams(location.search);
$('#q').value = params.get('q') ?? '';
$('#tipo').value = ['project', 'quick'].includes(params.get('tipo')) ? params.get('tipo') : '';

(async () => {
  if (!(await warnIfUnconfigured($('#aviso')))) return;
  const [categories, viewer] = await Promise.all([fillCategories($('#categoria'), params.get('categoria')), getViewer()]);
  if (viewer.skills.size) $('#so-meus').hidden = false;
  const state = () => ({ q: $('#q').value.trim(), cat: categories.find((c) => c.slug === $('#categoria').value), tipo: $('#tipo').value });

  const feed = createFeed({
    table: 'projects', kind: 'project', viewer, renderItem: renderProject,
    // com o filtro ligado, o banco só devolve projetos que pedem ao menos uma habilidade do profissional
    select: () => ($('#para-mim').checked ? PROJECT_SELECT.replace('project_skills(', 'project_skills!inner(') : PROJECT_SELECT),
    empty: ['Nenhum projeto aberto com esses filtros', 'Tente outra área ou remova a palavra-chave.'],
    adCategory: () => state().cat?.id ?? null,
    applyFilters(query) {
      const s = state();
      let q = query.eq('is_public', true);
      if (s.cat) q = q.eq('category_id', s.cat.id);
      if (s.tipo) q = q.eq('kind', s.tipo);
      if ($('#para-mim').checked) q = q.in('project_skills.skill_id', [...viewer.skills]);
      if (s.q) q = q.textSearch('search', s.q, { config: 'portuguese', type: 'websearch' });
      return q;
    },
  });

  const refresh = () => {
    const s = state();
    const base = s.tipo === 'quick' ? 'Bico Rápido' : 'Projetos remotos';
    $('#titulo').textContent = s.cat ? `${base} de ${s.cat.name}` : base;
    document.title = `${$('#titulo').textContent} — Bico BR`;
    mountAdSlot($('#ad-lateral'), 'sidebar', s.cat?.id ?? null, 2);
    feed.reload();
  };
  $('#filtros').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = state();
    const next = new URLSearchParams();
    if (s.q) next.set('q', s.q);
    if (s.cat) next.set('categoria', s.cat.slug);
    if (s.tipo) next.set('tipo', s.tipo);
    history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`);
    refresh();
  });
  for (const id of ['#categoria', '#tipo', '#para-mim']) $(id).addEventListener('change', () => $('#filtros').requestSubmit());
  refresh();
})();
