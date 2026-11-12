import { $, getClient, showNotice } from './core.js';
import { bindCards, emptyState, fetchAds, houseAd, loadViewerState, renderAd, skeletons, trackAds } from './cards.js';

const PAGE = 10;
const quote = (v) => `"${String(v).replace(/"/g, '')}"`;

/**
 * Feed paginado por cursor (keyset): nunca carrega tudo de uma vez e não degrada em páginas
 * profundas. A cada página, um espaço patrocinado é intercalado (sempre rotulado).
 */
export function createFeed({ table, kind, select, applyFilters, renderItem, viewer, empty, adCategory = () => null }) {
  const list = $('#lista');
  const more = $('#mais');
  const aviso = $('#aviso');
  let cursor = null; let loading = false; let page = 0;
  bindCards(list, viewer);

  async function load(reset) {
    if (loading) return;
    loading = true;
    const { sb } = await getClient();
    if (!sb) { loading = false; return; }
    if (reset) { cursor = null; page = 0; list.innerHTML = skeletons(); }
    let query = sb.from(table).select(typeof select === 'function' ? select() : select).eq('status', 'open')
      .order('published_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE + 1);
    query = applyFilters(query);
    if (cursor) query = query.or(`published_at.lt.${quote(cursor.at)},and(published_at.eq.${quote(cursor.at)},id.lt.${cursor.id})`);
    const [{ data, error }, ads, { cfg }] = await Promise.all([query, fetchAds('feed_inline', adCategory(), 1), getClient()]);
    if (error) { loading = false; if (reset) list.innerHTML = ''; return showNotice(aviso, 'error', 'Não foi possível carregar a lista. Tente novamente.'); }
    aviso.hidden = true;
    const rows = data.slice(0, PAGE);
    await loadViewerState(viewer, kind, rows.map((r) => r.id));
    loading = false;
    if (reset) list.innerHTML = '';
    if (reset && !rows.length) list.innerHTML = emptyState(empty[0], empty[1]);
    const items = rows.map((r) => renderItem(r, viewer));
    if (rows.length >= 3) items.splice(3, 0, (ads[0] && renderAd(ads[0], cfg.supabaseUrl)) || (page === 0 ? houseAd('li', 'feed_inline') : ''));
    list.insertAdjacentHTML('beforeend', items.join(''));
    trackAds(list);
    more.hidden = data.length <= PAGE;
    const last = rows.at(-1);
    if (last) cursor = { at: last.published_at, id: last.id };
    page += 1;
  }

  more.addEventListener('click', () => load(false));
  return { reload: () => load(true) };
}

export async function fillCategories(select, selected) {
  const { sb } = await getClient();
  if (!sb) return [];
  const { data } = await sb.from('categories').select('id, slug, name').order('sort_order');
  for (const c of data ?? []) select.add(new Option(c.name, c.slug, false, c.slug === selected));
  return data ?? [];
}
