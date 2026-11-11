import { $, budgetLabel, esc, mountChrome, timeAgo, warnIfUnconfigured } from './core.js';
import { createFeed, fillCategories } from './listagem.js';

mountChrome();
const params = new URLSearchParams(location.search);
$('#q').value = params.get('q') ?? '';
$('#tipo').value = ['project', 'quick'].includes(params.get('tipo')) ? params.get('tipo') : '';

(async () => {
  if (!(await warnIfUnconfigured($('#aviso')))) return;
  const categories = await fillCategories($('#categoria'), params.get('categoria'));
  const state = () => ({ q: $('#q').value.trim(), cat: categories.find((c) => c.slug === $('#categoria').value), tipo: $('#tipo').value });

  const feed = createFeed({
    table: 'projects',
    select: 'id, kind, title, description, budget_type, budget_min_cents, budget_max_cents, deadline_days, published_at, proposals_count, categories(name), companies(display_name, uf)',
    emptyText: 'Nenhum projeto aberto com esses filtros no momento.',
    applyFilters(query) {
      const s = state();
      let q = query.eq('is_public', true);
      if (s.cat) q = q.eq('category_id', s.cat.id);
      if (s.tipo) q = q.eq('kind', s.tipo);
      if (s.q) q = q.textSearch('search', s.q, { config: 'portuguese', type: 'websearch' });
      return q;
    },
    renderItem: (p) => `
      <li><a class="card block transition hover:border-mata-500" href="/projeto?id=${esc(p.id)}">
        <div class="flex flex-wrap items-center gap-2">
          ${p.kind === 'quick' ? '<span class="chip-sol">Bico Rápido</span>' : ''}
          <span class="chip">${esc(p.categories?.name)}</span>
          <span class="text-xs text-tinta-500">${esc(timeAgo(p.published_at))} · ${p.proposals_count} proposta${p.proposals_count === 1 ? '' : 's'}</span>
        </div>
        <h2 class="mt-2 text-lg font-semibold">${esc(p.title)}</h2>
        <p class="mt-1 line-clamp-2 text-sm text-tinta-700">${esc(p.description)}</p>
        <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <strong>${esc(budgetLabel(p))}</strong>
          ${p.deadline_days ? `<span class="text-tinta-500">Prazo: ${p.deadline_days} dia${p.deadline_days === 1 ? '' : 's'}</span>` : ''}
          <span class="text-tinta-500">${esc(p.companies?.display_name)}${p.companies?.uf ? ` · ${esc(p.companies.uf)}` : ''}</span>
        </p>
      </a></li>`,
  });

  const titleFor = () => {
    const s = state();
    const base = s.tipo === 'quick' ? 'Bico Rápido' : 'Projetos remotos';
    $('#titulo').textContent = s.cat ? `${base} de ${s.cat.name}` : base;
    document.title = `${$('#titulo').textContent} — Bico BR`;
  };
  $('#filtros').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = state();
    const next = new URLSearchParams();
    if (s.q) next.set('q', s.q);
    if (s.cat) next.set('categoria', s.cat.slug);
    if (s.tipo) next.set('tipo', s.tipo);
    history.replaceState(null, '', `${location.pathname}${next.size ? `?${next}` : ''}`);
    titleFor();
    feed.reload();
  });
  titleFor();
  feed.reload();
})();
