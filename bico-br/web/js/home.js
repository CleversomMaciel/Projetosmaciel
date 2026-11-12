import { $, esc, getClient, icon, mountChrome, warnIfUnconfigured } from './core.js';
import { JOB_SELECT, PROJECT_SELECT, bindCards, emptyState, getViewer, loadViewerState, mountAdSlot, renderJob, renderProject } from './cards.js';

mountChrome();
const CATEGORY_ICONS = { code: 'code', chart: 'chart', palette: 'palette', video: 'video', megaphone: 'megaphone', briefcase: 'briefcase', users: 'users', pen: 'pen', ruler: 'ruler', compass: 'compass', book: 'book' };

(async () => {
  const list = $('#categorias');
  if (!(await warnIfUnconfigured($('#aviso')))) { list.innerHTML = ''; $('#home-projetos').innerHTML = ''; $('#home-vagas').innerHTML = ''; return; }
  const { sb } = await getClient();
  mountAdSlot($('#ad-banner'), 'home_banner', null, 1);

  const [{ data: cats }, { data: projects }, { data: jobs }, viewer] = await Promise.all([
    sb.from('categories').select('slug, name, description, icon').order('sort_order'),
    sb.from('projects').select(PROJECT_SELECT).eq('status', 'open').eq('is_public', true).order('published_at', { ascending: false }).limit(4),
    sb.from('jobs').select(JOB_SELECT).eq('status', 'open').order('published_at', { ascending: false }).limit(4),
    getViewer(),
  ]);

  list.innerHTML = (cats ?? []).map((c) => `
    <li><a class="tile" href="/projetos?categoria=${encodeURIComponent(c.slug)}">
      <span class="tile-icon">${icon(CATEGORY_ICONS[c.icon] ?? 'layers')}</span>
      <span><strong class="block">${esc(c.name)}</strong><span class="mt-0.5 block text-sm text-tinta-500">${esc(c.description)}</span></span>
    </a></li>`).join('') || '<li class="panel text-sm text-tinta-500">Não foi possível carregar as áreas agora.</li>';

  await Promise.all([
    loadViewerState(viewer, 'project', (projects ?? []).map((p) => p.id)),
    loadViewerState(viewer, 'job', (jobs ?? []).map((j) => j.id)),
  ]);
  const pList = $('#home-projetos'); const jList = $('#home-vagas');
  pList.innerHTML = (projects ?? []).map((p) => renderProject(p, viewer)).join('') || emptyState('Nenhum projeto aberto ainda', 'Seja a primeira empresa a publicar.');
  jList.innerHTML = (jobs ?? []).map((j) => renderJob(j, viewer)).join('') || emptyState('Nenhuma vaga aberta ainda', 'Publique uma vaga 100% remota.');
  bindCards(pList, viewer); bindCards(jList, viewer);
})();
