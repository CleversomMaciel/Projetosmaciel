import { $, esc, getClient, icon, mountChrome, warnIfUnconfigured } from './core.js';
import { PROJECT_SELECT, bindCards, emptyState, getViewer, loadViewerState, mountAdSlot, renderProject } from './cards.js';

mountChrome();
const ICONS = ['code', 'layers', 'chart', 'bolt', 'compass', 'shield', 'pen', 'users'];

(async () => {
  const list = $('#categorias');
  if (!(await warnIfUnconfigured($('#aviso')))) { list.innerHTML = ''; $('#home-projetos').innerHTML = ''; return; }
  const { sb } = await getClient();
  mountAdSlot($('#ad-banner'), 'home_banner', null, 1);

  const [{ data: cats }, { data: projects }, viewer] = await Promise.all([
    sb.from('categories').select('slug, name, subcategories(name, sort_order)').order('sort_order'),
    sb.from('projects').select(PROJECT_SELECT).eq('status', 'open').eq('is_public', true).order('published_at', { ascending: false }).limit(6),
    getViewer(),
  ]);
  // especialidades: cada uma abre a busca de projetos já filtrada
  const specialties = (cats ?? []).flatMap((c) => (c.subcategories ?? []).sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ name: s.name, cat: c })));
  const seen = new Set();
  list.innerHTML = specialties.filter((s) => !seen.has(s.name) && seen.add(s.name)).slice(0, 18).map((s, i) => `
    <li><a class="tile items-center" href="/projetos?categoria=${encodeURIComponent(s.cat.slug)}&q=${encodeURIComponent(s.name)}">
      <span class="tile-icon">${icon(ICONS[i % ICONS.length])}</span>
      <span><strong class="block">${esc(s.name)}</strong><span class="block text-xs text-tinta-500">${esc(s.cat.name)}</span></span>
    </a></li>`).join('') || '<li class="panel text-sm text-tinta-500">Não foi possível carregar as especialidades agora.</li>';

  await loadViewerState(viewer, 'project', (projects ?? []).map((p) => p.id));
  const pList = $('#home-projetos');
  pList.innerHTML = (projects ?? []).map((p) => renderProject(p, viewer)).join('') || emptyState('Nenhum projeto aberto ainda', 'Seja o primeiro a publicar.');
  bindCards(pList, viewer);
})();
