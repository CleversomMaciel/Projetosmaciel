import { $, getClient, getSession, mountChrome, showNotice, warnIfUnconfigured } from './core.js';
import { emptyState, skeletons } from './cards.js';
import { POST_SELECT, bindLikes, likedSet, renderPost } from './publicacoes.js';

mountChrome();
const PAGE = 12;
const list = $('#lista'); const more = $('#mais');

(async () => {
  if (!(await warnIfUnconfigured($('#aviso')))) return;
  const { sb, cfg } = await getClient();
  const session = await getSession();
  const uid = session?.user.id ?? null;
  let cursor = null;

  async function load(reset) {
    if (reset) { cursor = null; list.innerHTML = skeletons(3); }
    // só publicações públicas de quem tornou o perfil público
    let q = sb.from('portfolio_items')
      .select(`${POST_SELECT}, freelancer_profiles!inner(slug, headline, is_public, profiles!freelancer_profiles_user_id_fkey(display_name))`)
      .eq('visibility', 'public').eq('freelancer_profiles.is_public', true)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE + 1);
    if (cursor) q = q.lt('created_at', cursor);
    const { data, error } = await q;
    if (reset) list.innerHTML = '';
    if (error) return showNotice($('#aviso'), 'error', 'Não foi possível carregar a vitrine.');
    const rows = (data ?? []).slice(0, PAGE);
    if (reset && !rows.length) list.innerHTML = emptyState('A vitrine ainda está vazia', 'Profissionais com perfil público aparecem aqui quando publicam seus trabalhos.');
    const liked = await likedSet(uid, rows.map((r) => r.id));
    list.insertAdjacentHTML('beforeend', rows.map((r) => renderPost(r, {
      base: cfg.supabaseUrl, liked: liked.has(r.id), canLike: Boolean(uid) && r.user_id !== uid,
      author: { slug: r.freelancer_profiles.slug, headline: r.freelancer_profiles.headline, name: r.freelancer_profiles.profiles?.display_name || 'Profissional' },
    })).join(''));
    more.hidden = (data ?? []).length <= PAGE;
    if (rows.length) cursor = rows.at(-1).created_at;
  }
  more.addEventListener('click', () => load(false));
  await bindLikes(list, uid);
  load(true);
})();
