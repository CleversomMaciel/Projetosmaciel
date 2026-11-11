import { $, esc, getClient, mountChrome, requireSession, setBusy, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');

(async () => {
  const session = await requireSession();
  const uid = session.user.id;
  const { sb } = await getClient();
  const { data: fp } = await sb.from('freelancer_profiles').select('slug, headline, bio, availability, tools, is_public').eq('user_id', uid).maybeSingle();
  if (!fp) return showNotice(aviso, 'warn', 'O perfil profissional é para contas de profissional.');
  $('#form').hidden = false; $('#portfolio').hidden = false;
  $('#headline').value = fp.headline ?? ''; $('#bio').value = fp.bio ?? ''; $('#availability').value = fp.availability ?? '';
  $('#tools').value = (fp.tools ?? []).join(', '); $('#slug').value = fp.slug; $('#publico').checked = fp.is_public;
  $('#ver').href = `/profissional?u=${encodeURIComponent(fp.slug)}`;

  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const slug = $('#slug').value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return showNotice(aviso, 'error', 'O endereço do perfil aceita letras minúsculas, números e hífen (3 a 60 caracteres).');
    const tools = [...new Set($('#tools').value.split(',').map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 40);
    setBusy(ev.submitter, true, 'Salvando…');
    const { error } = await sb.from('freelancer_profiles').update({
      headline: $('#headline').value.trim() || null, bio: $('#bio').value.trim() || null,
      availability: $('#availability').value || null, tools, slug, is_public: $('#publico').checked,
    }).eq('user_id', uid);
    setBusy(ev.submitter, false);
    if (error) return showNotice(aviso, 'error', error.code === '23505' ? 'Este endereço de perfil já está em uso.' : 'Não foi possível salvar o perfil.');
    $('#ver').href = `/profissional?u=${encodeURIComponent(slug)}`;
    showNotice(aviso, 'info', 'Perfil salvo.');
  });

  const list = $('#itens');
  async function loadItems() {
    const { data } = await sb.from('portfolio_items').select('id, title, description, link_url, visibility, origin').eq('user_id', uid).order('created_at', { ascending: false }).limit(200);
    list.innerHTML = (data ?? []).map((i) => `<li class="card text-sm">
      <div class="flex items-start justify-between gap-3"><div><strong>${esc(i.title)}</strong>
        ${i.origin === 'bico_br' ? '<span class="chip-sol ml-1">Feito no Bico BR</span>' : '<span class="chip ml-1">Trabalho externo</span>'}
        ${i.visibility === 'private' ? '<span class="chip ml-1">Só eu</span>' : ''}</div>
        <button class="linkish text-xs" type="button" data-del="${esc(i.id)}">Excluir</button></div>
      ${i.description ? `<p class="mt-1 whitespace-pre-line text-tinta-700">${esc(i.description)}</p>` : ''}
      ${i.link_url ? `<p class="mt-1 break-all text-xs text-tinta-500">${esc(i.link_url)}</p>` : ''}</li>`).join('') || '<li class="text-sm text-tinta-500">Nenhum trabalho no portfólio ainda.</li>';
  }
  list.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-del]');
    if (!el || !confirm('Excluir este trabalho do portfólio?')) return;
    await sb.from('portfolio_items').delete().eq('id', el.dataset.del).eq('user_id', uid);
    loadItems();
  });
  $('#novo-item').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const link = $('#pl').value.trim();
    if ($('#pt').value.trim().length < 2) return showNotice(aviso, 'error', 'Informe o título do trabalho.');
    if (link && !/^https?:\/\//i.test(link)) return showNotice(aviso, 'error', 'O link precisa começar com http:// ou https://');
    const { error } = await sb.from('portfolio_items').insert({ user_id: uid, title: $('#pt').value.trim(), description: $('#pd').value.trim() || null, link_url: link || null, visibility: $('#pv').value });
    if (error) return showNotice(aviso, 'error', 'Não foi possível adicionar o trabalho.');
    ev.target.reset();
    loadItems();
  });
  loadItems();
})();
