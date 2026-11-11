import { $, getClient, showNotice } from './core.js';

const PAGE = 12;
const quote = (v) => `"${String(v).replace(/"/g, '')}"`;

/**
 * Listagem paginada por cursor (keyset): nunca carrega tudo de uma vez e não fica lenta
 * em páginas profundas como OFFSET. Ordenação: published_at desc, id desc.
 */
export function createFeed({ table, select, applyFilters, renderItem, emptyText }) {
  const list = $('#lista');
  const more = $('#mais');
  const aviso = $('#aviso');
  let cursor = null;
  let loading = false;

  async function load(reset) {
    if (loading) return;
    loading = true;
    const { sb } = await getClient();
    if (!sb) { loading = false; return; }
    if (reset) { cursor = null; list.innerHTML = '<li class="card text-sm text-tinta-500">Carregando…</li>'; }
    let query = sb.from(table).select(select).eq('status', 'open')
      .order('published_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE + 1);
    query = applyFilters(query);
    if (cursor) query = query.or(`published_at.lt.${quote(cursor.at)},and(published_at.eq.${quote(cursor.at)},id.lt.${cursor.id})`);
    const { data, error } = await query;
    loading = false;
    if (reset) list.innerHTML = '';
    if (error) return showNotice(aviso, 'error', 'Não foi possível carregar a lista. Tente novamente.');
    aviso.hidden = true;
    const rows = data.slice(0, PAGE);
    if (reset && !rows.length) list.innerHTML = `<li class="card text-sm text-tinta-500">${emptyText}</li>`;
    list.insertAdjacentHTML('beforeend', rows.map(renderItem).join(''));
    more.hidden = data.length <= PAGE;
    const last = rows.at(-1);
    if (last) cursor = { at: last.published_at, id: last.id };
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
