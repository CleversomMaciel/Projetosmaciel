import { $, esc, getClient, getProfile, icon, mountChrome, responseLabel, rpcMessage, showNotice, warnIfUnconfigured } from './core.js';
import { allSkills } from './habilidades.js';
import { emptyState, skeletons } from './cards.js';

mountChrome();
const PAGE = 12;
const list = $('#lista'); const more = $('#mais'); const aviso = $('#aviso');
const AVAIL = { full_time: 'Tempo integral', part_time: 'Meio período', weekends: 'Fins de semana', unavailable: 'Indisponível' };

(async () => {
  if (!(await warnIfUnconfigured(aviso))) return;
  const { sb } = await getClient();
  const [skills, profile] = await Promise.all([allSkills(), getProfile()]);
  const wanted = new URLSearchParams(location.search).get('h');
  for (const s of skills) $('#habilidade').add(new Option(s.name, s.id, false, s.id === wanted));

  // empresa logada: seus projetos abertos, para convidar direto do card
  let myProjects = [];
  if (profile?.account_type === 'company') {
    const { data: company } = await sb.from('companies').select('id').eq('owner_id', profile.id).maybeSingle();
    if (company) myProjects = (await sb.from('projects').select('id, title').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(50)).data ?? [];
  }
  const invite = (f) => {
    if (!profile) return `<a class="btn-ghost" href="/entrar?next=${encodeURIComponent('/profissionais')}">Entrar para convidar</a>`;
    if (profile.account_type !== 'company') return '';
    if (!myProjects.length) return '<a class="btn-ghost" href="/publicar-projeto">Publique um projeto para convidar</a>';
    return `<form class="flex flex-wrap items-end gap-2" data-invite="${esc(f.user_id)}" novalidate>
      <span class="min-w-0 flex-1"><label class="sr-only" for="pj-${esc(f.user_id)}">Projeto</label><select class="input" id="pj-${esc(f.user_id)}">${myProjects.map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></span>
      <button class="btn-primary" type="submit">${icon('chat')} Convidar e conversar</button></form>`;
  };
  const card = (f) => `<li class="card flex flex-col gap-3">
    <div><a class="text-lg font-bold hover:text-mata-700" href="/profissional?u=${encodeURIComponent(f.slug)}">${esc(f.profiles?.display_name || 'Profissional')}</a>
      <p class="text-sm text-tinta-700">${esc(f.headline)}</p>
      <p class="mt-1 text-xs text-tinta-500">${esc([f.profiles?.city, f.profiles?.uf].filter(Boolean).join(' · '))}${f.availability ? ` · ${esc(AVAIL[f.availability])}` : ''} · ${f.completed_projects} projeto(s) concluído(s) · ${f.rating_count ? `nota ${Number(f.rating_avg).toFixed(1)}` : 'sem avaliações'}</p>
      ${responseLabel(f.profiles?.response_count, f.profiles?.response_seconds) ? `<p class="mt-1 text-xs font-semibold text-mata-700">${esc(responseLabel(f.profiles.response_count, f.profiles.response_seconds))}</p>` : ''}</div>
    <p class="flex flex-wrap gap-1.5">${(f.freelancer_skills ?? []).slice(0, 10).map((k) => `<span class="chip">${esc(k.skills?.name)}</span>`).join('')}</p>
    <div class="mt-auto">${invite(f)}</div></li>`;

  let offset = 0;
  async function load(reset) {
    if (reset) { offset = 0; list.innerHTML = skeletons(2); }
    const skill = $('#habilidade').value;
    const embed = skill ? 'freelancer_skills!inner(skill_id, skills(name))' : 'freelancer_skills(skill_id, skills(name))';
    let q = sb.from('freelancer_profiles')
      .select(`user_id, slug, headline, availability, completed_projects, rating_avg, rating_count, profiles!freelancer_profiles_user_id_fkey(display_name, city, uf, response_count, response_seconds), ${embed}`)
      .eq('is_public', true) // só quem autorizou aparecer
      .order('completed_projects', { ascending: false }).order('user_id').range(offset, offset + PAGE);
    if (skill) q = q.eq('freelancer_skills.skill_id', skill);
    const { data, error } = await q;
    if (reset) list.innerHTML = '';
    if (error) return showNotice(aviso, 'error', 'Não foi possível carregar os profissionais.');
    const rows = (data ?? []).slice(0, PAGE);
    if (reset && !rows.length) list.innerHTML = emptyState('Nenhum profissional público com essa habilidade', 'Tente outra habilidade ou publique seu projeto: quem tem o perfil certo é avisado.');
    list.insertAdjacentHTML('beforeend', rows.map(card).join(''));
    more.hidden = (data ?? []).length <= PAGE;
    offset += PAGE;
  }
  more.addEventListener('click', () => load(false));
  $('#filtros').addEventListener('submit', (ev) => { ev.preventDefault(); load(true); });
  $('#habilidade').addEventListener('change', () => load(true));

  list.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('[data-invite]');
    if (!form) return;
    ev.preventDefault();
    const projectId = $('select', form).value; const freelancerId = form.dataset.invite;
    ev.submitter.disabled = true;
    const ins = await sb.from('project_invites').insert({ project_id: projectId, freelancer_id: freelancerId, invited_by: profile.id });
    if (ins.error && ins.error.code !== '23505') { ev.submitter.disabled = false; return showNotice(aviso, 'error', rpcMessage(ins.error, 'Não foi possível convidar.')); }
    const { data, error } = await sb.rpc('start_project_conversation', { p_project_id: projectId, p_freelancer_id: freelancerId });
    if (error) { ev.submitter.disabled = false; return showNotice(aviso, 'error', rpcMessage(error, 'Convite enviado, mas não foi possível abrir a conversa.')); }
    location.href = `/mensagens?c=${data}`;
  });
  load(true);
})();
