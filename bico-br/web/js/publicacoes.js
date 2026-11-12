// Publicações (vitrine): o que o profissional mostra do próprio trabalho. Outros curtem e pedem serviço.
import { esc, fmtDate, getClient, icon } from './core.js';

const MEDIA_PATH = /^[0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(png|jpg|jpeg|webp)$/;
export const postImageUrl = (base, item) => {
  const path = item.media?.[0]?.path;
  return base && MEDIA_PATH.test(path ?? '') ? `${base.replace(/\/$/, '')}/storage/v1/object/public/portfolio-public/${path}` : null;
};
export const POST_SELECT = 'id, user_id, title, description, media, origin, likes_count, created_at';

export function renderPost(item, { base, liked = false, canLike = false, author = null }) {
  const img = postImageUrl(base, item);
  return `<li class="card flex flex-col gap-3 p-0 overflow-hidden" data-post="${esc(item.id)}">
    ${img ? `<img class="aspect-[16/10] w-full object-cover" src="${esc(img)}" alt="Imagem da publicação: ${esc(item.title)}" loading="lazy" decoding="async">` : ''}
    <div class="flex flex-1 flex-col gap-2 px-5 pb-5 ${img ? '' : 'pt-5'}">
      ${author ? `<a class="text-sm font-semibold text-tinta-700 hover:text-mata-700" href="/profissional?u=${encodeURIComponent(author.slug)}">${esc(author.name)}<span class="block text-xs font-normal text-tinta-500">${esc(author.headline ?? '')}</span></a>` : ''}
      <p>${item.origin === 'bico_br' ? '<span class="chip-sol">Projeto realizado no Bico BR</span>' : '<span class="chip-neutral">Trabalho informado pelo profissional</span>'}</p>
      <h3 class="text-lg font-bold leading-snug">${esc(item.title)}</h3>
      ${item.description ? `<p class="whitespace-pre-line text-sm text-tinta-700">${esc(item.description)}</p>` : ''}
      <div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
        <button type="button" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition ${liked ? 'bg-sol-400 text-marinho-900' : 'bg-tinta/[.06] text-tinta-700 hover:bg-mata-50'}" data-like aria-pressed="${liked}" ${canLike ? '' : 'disabled'} title="${canLike ? 'Curtir' : 'Entre para curtir'}">${icon('star', 'icon h-4 w-4')} <span data-likes>${item.likes_count}</span></button>
        ${author ? `<a class="btn-ghost" href="/profissional?u=${encodeURIComponent(author.slug)}#convidar">Solicitar serviço</a>` : `<span class="text-xs text-tinta-500">${fmtDate(item.created_at)}</span>`}
      </div>
    </div></li>`;
}

/** Marca quais publicações o usuário já curtiu e liga o botão. */
export async function bindLikes(list, userId) {
  const { sb } = await getClient();
  if (!userId || list.dataset.likes) return;
  list.dataset.likes = '1';
  list.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-like]');
    if (!btn || btn.disabled) return;
    const id = btn.closest('[data-post]').dataset.post;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.disabled = true;
    const { error } = on ? await sb.from('post_likes').insert({ item_id: id, user_id: userId })
      : await sb.from('post_likes').delete().eq('item_id', id).eq('user_id', userId);
    btn.disabled = false;
    if (error && error.code !== '23505') return;
    btn.setAttribute('aria-pressed', String(on));
    btn.className = btn.className.replace(on ? 'bg-tinta/[.06] text-tinta-700 hover:bg-mata-50' : 'bg-sol-400 text-marinho-900', on ? 'bg-sol-400 text-marinho-900' : 'bg-tinta/[.06] text-tinta-700 hover:bg-mata-50');
    const n = btn.querySelector('[data-likes]'); n.textContent = Math.max(0, Number(n.textContent) + (on ? 1 : -1));
  });
}
export async function likedSet(userId, ids) {
  if (!userId || !ids.length) return new Set();
  const { sb } = await getClient();
  const { data } = await sb.from('post_likes').select('item_id').eq('user_id', userId).in('item_id', ids);
  return new Set((data ?? []).map((r) => r.item_id));
}
