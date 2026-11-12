// Cards expansíveis de projetos. Tudo é resolvido dentro do card:
// ler os detalhes, enviar proposta e abrir a conversa.
import { $, brl, budgetLabel, esc, getClient, getProfile, icon, parseBrlToCents, setBusy, showNotice, timeAgo } from './core.js';

const LEVEL = { estagio: 'Estágio', junior: 'Júnior', pleno: 'Pleno', senior: 'Sênior', especialista: 'Especialista' };
const PROPOSAL = { sent: 'Enviada', shortlisted: 'Pré-selecionada', accepted: 'Aceita', rejected: 'Recusada', withdrawn: 'Retirada' };
const PROPOSAL_ERRORS = {
  PRO_REQUIRED: 'Você já concluiu seu primeiro bico. Para enviar novas propostas, ative um plano em Meu painel → Ver planos.',
  QUOTA_EXCEEDED: 'Você usou todas as propostas do ciclo atual do seu plano.',
  ABUSE_LIMIT: 'Limite diário de segurança atingido. Tente novamente amanhã.',
};
const TONES = ['bg-marinho-900', 'bg-mata-600', 'bg-ouro', 'bg-marinho-700', 'bg-mata-500', 'bg-ouro-600'];
const avatar = (name) => {
  const n = String(name || '?').trim();
  const tone = TONES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return `<span class="avatar ${tone}" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>`;
};

export const PROJECT_SELECT = 'id, kind, status, title, description, deliverables, budget_type, budget_min_cents, budget_max_cents, deadline_days, experience_level, professionals_wanted, published_at, proposals_count, category_id, categories(name, slug), project_skills(skill_id, skills(name)), companies(display_name, city, uf, rating_avg, rating_count, cnpj_masked, registry_status, owner_id)';

/** Quem está vendo: perfil + o que já enviou para os itens exibidos. */
export async function getViewer() {
  const profile = await getProfile();
  const viewer = { profile, proposals: new Map(), applications: new Map(), skills: new Set() };
  if (profile?.account_type === 'freelancer') {
    const { sb } = await getClient();
    const { data } = await sb.from('freelancer_skills').select('skill_id').eq('user_id', profile.id);
    for (const r of data ?? []) viewer.skills.add(r.skill_id);
  }
  return viewer;
}
export async function loadViewerState(viewer, kind, ids) {
  if (!viewer.profile || !ids.length) return;
  const { sb } = await getClient();
  if (kind === 'project' && viewer.profile.account_type === 'freelancer') {
    const { data } = await sb.from('proposals').select('project_id, amount_cents, deadline_days, status').eq('freelancer_id', viewer.profile.id).in('project_id', ids);
    for (const p of data ?? []) viewer.proposals.set(p.project_id, p);
  }
}

const loginCta = (label) => `<a class="btn-primary" href="/entrar?next=${encodeURIComponent(location.pathname + location.search)}">${label}</a>
  <a class="btn-ghost" href="/cadastro">Criar conta grátis</a>`;

function projectAction(p, viewer) {
  const me = viewer.profile;
  if (!me) return `<div class="flex flex-wrap gap-2">${loginCta('Entrar para enviar proposta')}</div>`;
  if (p.companies?.owner_id === me.id) return `<a class="btn-primary" href="/projeto?id=${esc(p.id)}">Ver propostas recebidas (${p.proposals_count})</a>`;
  if (me.account_type !== 'freelancer') return '<p class="text-sm text-tinta-500">Propostas são enviadas por contas de profissional.</p>';
  const mine = viewer.proposals.get(p.id);
  if (mine) {
    return `<div class="flex flex-wrap items-center gap-3"><span class="chip">${icon('check', 'icon h-4 w-4')} Proposta ${esc((PROPOSAL[mine.status] ?? mine.status).toLowerCase())}: ${brl(mine.amount_cents)} · ${mine.deadline_days} dias</span>
      <button class="btn-ghost" type="button" data-chat="${esc(p.id)}">${icon('chat')} Conversar com a empresa</button></div>`;
  }
  const fixed = p.kind === 'quick';
  return `<form class="grid gap-3 sm:grid-cols-2" data-proposal="${esc(p.id)}" novalidate>
      <p class="text-sm font-bold sm:col-span-2">Enviar proposta</p>
      <p class="sm:col-span-2" data-notice hidden></p>
      <div><label class="label" for="v-${esc(p.id)}">Seu valor (R$)</label><input class="input" id="v-${esc(p.id)}" name="valor" inputmode="decimal" required value="${fixed && p.budget_min_cents ? (p.budget_min_cents / 100).toLocaleString('pt-BR') : ''}"></div>
      <div><label class="label" for="d-${esc(p.id)}">Prazo de entrega (dias)</label><input class="input" id="d-${esc(p.id)}" name="prazo" type="number" min="1" max="730" required value="${p.deadline_days ?? ''}"></div>
      <div class="sm:col-span-2"><label class="label" for="c-${esc(p.id)}">Apresentação</label><textarea class="input" id="c-${esc(p.id)}" name="carta" rows="4" minlength="20" maxlength="5000" required placeholder="Como você resolveria este projeto? Cite trabalhos parecidos."></textarea></div>
      <div class="sm:col-span-2"><button class="btn-primary" type="submit">Enviar proposta</button></div>
    </form>`;
}

export function renderProject(p, viewer) {
  const c = p.companies ?? {};
  const place = [c.city, c.uf].filter(Boolean).join(' · ');
  const skills = p.project_skills ?? [];
  const matched = skills.filter((k) => viewer.skills.has(k.skill_id)).length;
  const skillChips = skills.map((k) => `<span class="${viewer.skills.has(k.skill_id) ? 'chip' : 'chip-neutral'}">${viewer.skills.has(k.skill_id) ? icon('check', 'icon h-3.5 w-3.5') : ''}${esc(k.skills?.name)}</span>`).join('');
  return `<li class="xcard" data-card="${esc(p.id)}" data-kind="project">
    <button class="xcard-head" type="button" aria-expanded="false" aria-controls="x-${esc(p.id)}">
      ${avatar(c.display_name)}
      <span class="min-w-0 flex-1">
        <span class="flex flex-wrap items-center gap-1.5">
          ${p.kind === 'quick' ? `<span class="chip-sol">${icon('bolt', 'icon h-3.5 w-3.5')} Bico Rápido</span>` : ''}
          <span class="chip">${esc(p.categories?.name)}</span>
          ${p.experience_level ? `<span class="chip-neutral">${esc(LEVEL[p.experience_level])}</span>` : ''}
          ${matched ? `<span class="chip-sol">${icon('star', 'icon h-3.5 w-3.5')} Combina com ${matched} habilidade${matched === 1 ? '' : 's'} sua${matched === 1 ? '' : 's'}</span>` : ''}
        </span>
        <span class="mt-2 block text-lg font-bold leading-snug">${esc(p.title)}</span>
        <span class="mt-1 block text-sm text-tinta-500">${esc(c.display_name)}${place ? ` · ${esc(place)}` : ''} · ${esc(timeAgo(p.published_at))}</span>
        <span class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span class="inline-flex items-center gap-1.5 font-extrabold text-mata-600">${icon('wallet', 'icon h-4 w-4')} ${esc(budgetLabel(p))}</span>
          ${p.deadline_days ? `<span class="inline-flex items-center gap-1.5 text-tinta-700">${icon('clock', 'icon h-4 w-4')} ${p.deadline_days} dia${p.deadline_days === 1 ? '' : 's'}</span>` : ''}
          <span class="text-tinta-500">${p.proposals_count} proposta${p.proposals_count === 1 ? '' : 's'}</span>
        </span>
      </span>
      <span class="xcard-chevron">${icon('chevron')}</span>
    </button>
    <div class="xcard-panel" id="x-${esc(p.id)}" inert><div><div class="xcard-body space-y-5">
      <div><h3 class="text-sm font-bold">Sobre o projeto</h3><p class="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-tinta-700">${esc(p.description)}</p></div>
      ${skillChips ? `<div><h3 class="text-sm font-bold">Habilidades pedidas</h3><p class="mt-2 flex flex-wrap gap-1.5">${skillChips}</p></div>` : ''}
      ${p.deliverables ? `<div><h3 class="text-sm font-bold">O que deve ser entregue</h3><p class="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-tinta-700">${esc(p.deliverables)}</p></div>` : ''}
      <dl class="meta-grid">
        <div><dt>Orçamento</dt><dd>${esc(budgetLabel(p))}</dd></div>
        <div><dt>Prazo</dt><dd>${p.deadline_days ? `${p.deadline_days} dias` : 'A combinar'}</dd></div>
        <div><dt>Profissionais</dt><dd>${p.professionals_wanted}</dd></div>
        <div><dt>Modalidade</dt><dd>100% remoto</dd></div>
      </dl>
      <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-500">
        <span class="inline-flex items-center gap-1">${icon('star', 'icon h-4 w-4')} ${c.rating_count ? `${Number(c.rating_avg).toFixed(1)} (${c.rating_count} avaliações)` : 'Empresa ainda sem avaliações'}</span>
        ${c.cnpj_masked ? `<span class="inline-flex items-center gap-1">${icon('shield', 'icon h-4 w-4')} CNPJ ${esc(c.cnpj_masked)}${c.registry_status ? ` · situação ${esc(c.registry_status.toLowerCase())}` : ''}</span>` : ''}
        <a class="linkish" href="/projeto?id=${esc(p.id)}">Abrir página do projeto</a>
        <a class="hover:text-tinta" href="/suporte?denunciar=project:${esc(p.id)}">Denunciar</a>
      </p>
      <div class="rounded-2xl bg-white p-4 ring-1 ring-tinta/[.06] sm:p-5" data-action-zone>${projectAction(p, viewer)}</div>
    </div></div></div>
  </li>`;
}

// ---------------------------------------------------------------- anúncios
export async function fetchAds(placement, categoryId = null, limit = 2) {
  const { sb } = await getClient();
  if (!sb) return [];
  const { data } = await sb.rpc('live_ads', { p_placement: placement, p_category: categoryId, p_limit: limit });
  return data ?? [];
}
const AD_PATH = /^[a-z0-9][a-z0-9/_-]{0,180}\.(png|jpg|jpeg|webp)$/;
export function adImageUrl(base, path) {
  return base && AD_PATH.test(path ?? '') ? `${base.replace(/\/$/, '')}/storage/v1/object/public/ads/${path}` : null;
}
/**
 * Anúncio pago: banner de imagem enviado pelo anunciante. Sempre com o selo "Patrocinado",
 * abre em nova aba sem repassar dados e só aceita imagem do nosso próprio armazenamento.
 */
export function renderAd(ad, base, tag = 'li') {
  const src = adImageUrl(base, ad.image_path);
  if (!src || !/^https:\/\//i.test(ad.target_url ?? '')) return '';
  return `<${tag}><a class="ad ad-${esc(ad.placement)}" href="${esc(ad.target_url)}" target="_blank" rel="sponsored noopener noreferrer" data-ad="${esc(ad.id)}">
    <img src="${esc(src)}" alt="${esc(ad.image_alt)}" loading="lazy" decoding="async">
    <span class="ad-label">Patrocinado</span><span class="ad-by">${esc(ad.advertiser_name)}</span></a></${tag}>`;
}
export const houseAd = (tag = 'li', placement = 'sidebar') => `<${tag}><a class="ad-house ${placement === 'home_banner' ? 'sm:flex-row sm:items-center sm:justify-between sm:gap-6' : ''}" href="/anuncie">
  <span><span class="chip-neutral">Espaço publicitário</span>
  <span class="mt-3 block font-bold">Anuncie sua empresa aqui</span>
  <span class="mt-1 block text-tinta-500">Sua arte neste espaço, vista por profissionais e empresas de todo o Brasil.</span></span>
  <span class="mt-3 inline-flex shrink-0 items-center gap-1 font-bold text-mata-700 sm:mt-0">Quero anunciar ${icon('arrow', 'icon h-4 w-4')}</span></a></${tag}>`;

export async function mountAdSlot(el, placement, categoryId = null, limit = 1) {
  if (!el) return;
  const [ads, { cfg }] = await Promise.all([fetchAds(placement, categoryId, limit), getClient()]);
  el.innerHTML = ads.map((a) => renderAd(a, cfg.supabaseUrl, 'div')).join('') || houseAd('div', placement);
  trackAds(el);
}
/** Conta exibição (uma vez por anúncio por página) e clique, só em totais — sem identificar o usuário. */
const seen = new Set();
export async function trackAds(root) {
  const { sb } = await getClient();
  if (!sb) return;
  for (const a of root.querySelectorAll('[data-ad]')) {
    if (seen.has(a.dataset.ad)) continue;
    seen.add(a.dataset.ad);
    sb.rpc('ad_event', { p_id: a.dataset.ad, p_kind: 'impression' }).then(() => {}, () => {});
    a.addEventListener('click', () => { sb.rpc('ad_event', { p_id: a.dataset.ad, p_kind: 'click' }).then(() => {}, () => {}); });
  }
}

// ---------------------------------------------------------------- comportamento dos cards
export function bindCards(list, viewer) {
  if (list.dataset.bound) return;
  list.dataset.bound = '1';

  list.addEventListener('click', async (ev) => {
    const head = ev.target.closest('.xcard-head');
    if (head) {
      const card = head.closest('.xcard');
      const open = !card.hasAttribute('data-open');
      card.toggleAttribute('data-open', open);
      head.setAttribute('aria-expanded', String(open));
      $('.xcard-panel', card).toggleAttribute('inert', !open); // fechado: fora da navegação por teclado e leitores de tela
      return;
    }
    const chat = ev.target.closest('[data-chat]');
    if (chat && viewer.profile) {
      chat.disabled = true;
      const { sb } = await getClient();
      const { data, error } = await sb.rpc('start_project_conversation', { p_project_id: chat.dataset.chat, p_freelancer_id: viewer.profile.id });
      if (error) { chat.disabled = false; return; }
      location.href = `/mensagens?c=${data}`;
    }
  });

  list.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('[data-proposal]');
    if (!form) return;
    ev.preventDefault();
    const notice = $('[data-notice]', form);
    const zone = form.closest('[data-action-zone]');
    const { sb } = await getClient();

    {
      const amount = parseBrlToCents(form.elements.valor.value);
      const days = Number.parseInt(form.elements.prazo.value, 10);
      const letter = form.elements.carta.value.trim();
      if (!amount) return showNotice(notice, 'error', 'Informe o valor da proposta.');
      if (!(days >= 1)) return showNotice(notice, 'error', 'Informe o prazo em dias.');
      if (letter.length < 20) return showNotice(notice, 'error', 'Escreva uma apresentação com pelo menos 20 caracteres.');
      setBusy(ev.submitter, true, 'Enviando…');
      const { error } = await sb.rpc('submit_proposal', { p_project_id: form.dataset.proposal, p_amount_cents: amount, p_deadline_days: days, p_cover_letter: letter });
      if (error) {
        setBusy(ev.submitter, false);
        return showNotice(notice, PROPOSAL_ERRORS[error.details] ? 'warn' : 'error', PROPOSAL_ERRORS[error.details] ?? (error.code === '23505' ? 'Você já enviou proposta para este projeto.' : 'Não foi possível enviar a proposta. Tente novamente.'));
      }
      viewer.proposals.set(form.dataset.proposal, { amount_cents: amount, deadline_days: days, status: 'sent' });
      zone.innerHTML = `<div class="flex flex-wrap items-center gap-3"><span class="chip">${icon('check', 'icon h-4 w-4')} Proposta enviada: ${brl(amount)} · ${days} dias</span>
        <button class="btn-ghost" type="button" data-chat="${esc(form.dataset.proposal)}">${icon('chat')} Conversar com a empresa</button></div>`;
      return;
    }

  });
}

export const skeletons = (n = 3) => Array.from({ length: n }, () => '<li class="skeleton h-36"></li>').join('');
export const emptyState = (title, text) => `<li class="panel text-center"><p class="font-bold">${title}</p><p class="mt-1 text-sm text-tinta-500">${text}</p></li>`;
