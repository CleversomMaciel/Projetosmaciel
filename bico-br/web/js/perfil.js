import { $, esc, getClient, imageKind, mountChrome, requireSession, rpcMessage, setBusy, showNotice } from './core.js';
import { POST_SELECT, renderPost } from './publicacoes.js';
import { mountSkillPicker, saveSkills } from './habilidades.js';

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
  const [{ data: mySkills }, { data: priv }] = await Promise.all([
    sb.from('freelancer_skills').select('skill_id').eq('user_id', uid),
    sb.from('profile_private').select('pix_key').eq('user_id', uid).maybeSingle(),
  ]);
  $('#pix').value = priv?.pix_key ?? '';
  const picker = await mountSkillPicker($('#habilidades'), { max: 30, selected: (mySkills ?? []).map((r) => r.skill_id) });

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
    const pix = $('#pix').value.trim();
    if (!error) {
      try {
        await saveSkills('freelancer_skills', 'user_id', uid, picker.get());
        const r = await sb.from('profile_private').update({ pix_key: pix || null }).eq('user_id', uid);
        if (r.error) throw r.error;
      } catch { setBusy(ev.submitter, false); return showNotice(aviso, 'error', 'Perfil salvo, mas não foi possível gravar habilidades ou a chave Pix. Confira os campos.'); }
    }
    setBusy(ev.submitter, false);
    if (error) return showNotice(aviso, 'error', error.code === '23505' ? 'Este endereço de perfil já está em uso.' : rpcMessage(error, 'Não foi possível salvar o perfil.'));
    $('#ver').href = `/profissional?u=${encodeURIComponent(slug)}`;
    showNotice(aviso, 'info', 'Perfil salvo.');
  });

  const list = $('#itens');
  const { cfg } = await getClient();
  async function loadItems() {
    const { data } = await sb.from('portfolio_items').select(`${POST_SELECT}, visibility`).eq('user_id', uid).order('created_at', { ascending: false }).limit(200);
    list.innerHTML = (data ?? []).map((i) => renderPost(i, { base: cfg.supabaseUrl }).replace('</li>', `<p class="flex items-center justify-between px-5 pb-4 text-xs text-tinta-500"><span>${i.visibility === 'private' ? 'Só eu vejo' : 'Público'}</span><button class="linkish" type="button" data-del="${esc(i.id)}">Excluir</button></p></li>`)).join('')
      || '<li class="text-sm text-tinta-500">Nenhuma publicação ainda.</li>';
  }
  list.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-del]');
    if (!el || !confirm('Excluir esta publicação?')) return;
    await sb.from('portfolio_items').delete().eq('id', el.dataset.del).eq('user_id', uid);
    loadItems();
  });
  $('#novo-item').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if ($('#pt').value.trim().length < 2) return showNotice(aviso, 'error', 'Informe o título do trabalho.');
    const file = $('#pi').files[0];
    const media = [];
    setBusy(ev.submitter, true, 'Publicando…');
    if (file) {
      const kind = await imageKind(file);
      if (!kind) { setBusy(ev.submitter, false); return showNotice(aviso, 'error', 'Imagem recusada: envie um PNG, JPG ou WebP de verdade.'); }
      if (file.size > 5 * 1024 * 1024) { setBusy(ev.submitter, false); return showNotice(aviso, 'error', 'A imagem passa de 5 MB.'); }
      const path = `${uid}/${crypto.randomUUID()}.${kind.ext}`;
      const up = await sb.storage.from('portfolio-public').upload(path, await file.arrayBuffer(), { contentType: kind.mime, upsert: false });
      if (up.error) { setBusy(ev.submitter, false); return showNotice(aviso, 'error', 'Não foi possível enviar a imagem.'); }
      media.push({ path });
    }
    const { error } = await sb.from('portfolio_items').insert({ user_id: uid, title: $('#pt').value.trim(), description: $('#pd').value.trim() || null, media, visibility: $('#pv').value });
    setBusy(ev.submitter, false);
    if (error) return showNotice(aviso, 'error', rpcMessage(error, 'Não foi possível publicar.'));
    aviso.hidden = true;
    ev.target.reset();
    loadItems();
  });
  loadItems();
})();
