import { $, esc, fmtDate, getClient, getProfile, icon, mountChrome, responseLabel, rpcMessage, showNotice, warnIfUnconfigured } from './core.js';
import { POST_SELECT, bindLikes, likedSet, renderPost } from './publicacoes.js';

mountChrome();
const root = $('#perfil');
const AVAIL = { full_time: 'Tempo integral', part_time: 'Meio período', weekends: 'Fins de semana', unavailable: 'Indisponível no momento' };

(async () => {
  const slug = new URLSearchParams(location.search).get('u') ?? '';
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) { root.innerHTML = '<p>Perfil não encontrado.</p>'; return; }
  if (!(await warnIfUnconfigured(root))) return;
  const { sb, cfg } = await getClient();
  const { data: f } = await sb.from('freelancer_profiles')
    .select('user_id, slug, headline, bio, availability, tools, completed_projects, rating_avg, rating_count, profiles!freelancer_profiles_user_id_fkey(display_name, city, uf, response_count, response_seconds), freelancer_skills(skills(name))')
    .eq('slug', slug).maybeSingle();
  if (!f) { root.innerHTML = '<p>Perfil não encontrado ou não público.</p>'; return; }
  const me = await getProfile();
  const [{ data: items }, { data: reviews }] = await Promise.all([
    sb.from('portfolio_items').select(POST_SELECT).eq('user_id', f.user_id).eq('visibility', 'public').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    sb.from('reviews').select('rating, comment, created_at').eq('reviewee_id', f.user_id).eq('reviewee_role', 'freelancer').order('created_at', { ascending: false }).limit(20),
  ]);
  const name = f.profiles?.display_name || 'Profissional';
  const response = responseLabel(f.profiles?.response_count, f.profiles?.response_seconds);
  document.title = `${name}${f.headline ? ` — ${f.headline}` : ''} | Bico BR`;

  // quem contrata: convida direto do perfil para um projeto aberto e a conversa abre na hora
  let invite = '';
  if (!me) invite = `<a class="btn-primary" href="/entrar?next=${encodeURIComponent(location.pathname + location.search)}">Entrar para solicitar serviço</a>`;
  else if (me.account_type === 'company') {
    const { data: company } = await sb.from('companies').select('id').eq('owner_id', me.id).maybeSingle();
    const projects = company ? (await sb.from('projects').select('id, title').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(50)).data ?? [] : [];
    invite = projects.length ? `<form id="form-convite" class="flex flex-wrap items-end gap-2" novalidate>
        <span class="min-w-0 flex-1"><label class="label" for="pj">Solicitar serviço para o projeto</label><select class="input" id="pj">${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></span>
        <button class="btn-primary" type="submit">${icon('chat')} Convidar e conversar</button></form>`
      : '<a class="btn-primary" href="/publicar-projeto">Publique um projeto para solicitar este serviço</a>';
  }
  const liked = await likedSet(me?.id, (items ?? []).map((i) => i.id));
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  root.innerHTML = `
    <header class="card">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><h1 class="text-3xl font-extrabold tracking-tight">${esc(name)}</h1><p class="mt-1 text-lg text-tinta-700">${esc(f.headline)}</p></div>
        <a class="text-xs text-tinta-500 hover:text-tinta" href="/suporte?denunciar=user:${esc(f.slug)}">Denunciar perfil</a>
      </div>
      <dl class="meta-grid mt-5">
        <div><dt>Avaliação</dt><dd>${f.rating_count ? `${Number(f.rating_avg).toFixed(1)} de 5 (${f.rating_count})` : 'Ainda sem avaliações'}</dd></div>
        <div><dt>Projetos no Bico BR</dt><dd>${f.completed_projects} concluído${f.completed_projects === 1 ? '' : 's'}</dd></div>
        <div><dt>Tempo de resposta</dt><dd>${response ? esc(response.replace('Costuma responder em cerca de ', '≈ ')) : 'Ainda não medido'}</dd></div>
        <div><dt>Disponibilidade</dt><dd>${esc(AVAIL[f.availability] ?? 'Não informada')}</dd></div>
      </dl>
      <p class="mt-3 text-sm text-tinta-500">${esc([f.profiles?.city, f.profiles?.uf].filter(Boolean).join(' · '))}</p>
      ${f.bio ? `<p class="mt-4 whitespace-pre-line text-sm leading-relaxed text-tinta-700">${esc(f.bio)}</p>` : ''}
      ${(f.freelancer_skills ?? []).length ? `<h2 class="mt-5 text-sm font-bold">Habilidades</h2><p class="mt-2 flex flex-wrap gap-1.5">${f.freelancer_skills.map((k) => `<span class="chip">${esc(k.skills?.name)}</span>`).join('')}</p>` : ''}
      ${(f.tools ?? []).length ? `<h2 class="mt-5 text-sm font-bold">Ferramentas</h2><p class="mt-2 flex flex-wrap gap-1.5">${f.tools.map((t) => `<span class="chip-neutral">${esc(t)}</span>`).join('')}</p>` : ''}
      <div id="convidar" class="mt-6 rounded-2xl bg-creme p-4 ring-1 ring-tinta/[.06]"><p id="c-aviso" hidden></p>${invite || '<p class="text-sm text-tinta-500">Empresas podem solicitar serviço a este profissional a partir de um projeto publicado.</p>'}</div>
    </header>
    <h2 class="mt-10 text-2xl font-extrabold tracking-tight">Publicações</h2>
    <ul id="posts" class="mt-4 grid gap-5 sm:grid-cols-2">${(items ?? []).map((i) => renderPost(i, { base: cfg.supabaseUrl, liked: liked.has(i.id), canLike: Boolean(me) && me.id !== f.user_id })).join('') || '<li class="text-sm text-tinta-500">Nenhuma publicação ainda.</li>'}</ul>
    <h2 class="mt-10 text-2xl font-extrabold tracking-tight">Avaliações de clientes</h2>
    <ul class="mt-4 space-y-3">${(reviews ?? []).map((r) => `<li class="card text-sm"><strong class="text-sol-500" aria-label="Nota ${r.rating} de 5">${stars(r.rating)}</strong> <span class="font-semibold">Nota ${r.rating}</span> <span class="text-xs text-tinta-500">${fmtDate(r.created_at)}</span>${r.comment ? `<p class="mt-1 text-tinta-700">${esc(r.comment)}</p>` : ''}</li>`).join('') || '<li class="text-sm text-tinta-500">Ainda sem avaliações. Elas só podem ser feitas por quem concluiu um contrato com este profissional.</li>'}</ul>`;

  await bindLikes($('#posts'), me && me.id !== f.user_id ? me.id : null);
  $('#form-convite')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    ev.submitter.disabled = true;
    const projectId = $('#pj').value;
    const ins = await sb.from('project_invites').insert({ project_id: projectId, freelancer_id: f.user_id, invited_by: me.id });
    if (ins.error && ins.error.code !== '23505') { ev.submitter.disabled = false; return showNotice($('#c-aviso'), 'error', rpcMessage(ins.error, 'Não foi possível convidar.')); }
    const { data, error } = await sb.rpc('start_project_conversation', { p_project_id: projectId, p_freelancer_id: f.user_id });
    if (error) { ev.submitter.disabled = false; return showNotice($('#c-aviso'), 'error', rpcMessage(error)); }
    location.href = `/mensagens?c=${data}`;
  });
  if (location.hash === '#convidar') $('#convidar').scrollIntoView({ block: 'center' });
})();
