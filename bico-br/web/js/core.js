// Núcleo do frontend: configuração pública, cliente Supabase, sessão, chamadas à API e utilitários.
// Nenhum segredo vive aqui: /api/config devolve apenas a URL e a chave pública (anon) do Supabase.

let clientPromise = null;

export function getClient() {
  if (!clientPromise) {
    clientPromise = fetch('/api/config').then((r) => r.json()).then((cfg) => {
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return { sb: null, cfg };
      return { sb: window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey), cfg };
    }).catch(() => ({ sb: null, cfg: {} }));
  }
  return clientPromise;
}

export async function getSession() {
  const { sb } = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  const { sb } = await getClient();
  const { data } = await sb.from('profiles').select('id, account_type, display_name, onboarded_at').eq('id', session.user.id).maybeSingle();
  return data;
}

/** Exige login; sem sessão, manda para /entrar guardando o destino. */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    location.replace(`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`);
    return new Promise(() => {});
  }
  return session;
}

export async function api(path, { method = 'GET', body } = {}) {
  const session = await getSession();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json?.error?.message || 'Não foi possível concluir. Tente novamente.'), { status: res.status, code: json?.error?.code });
  return json;
}

// ---------------------------------------------------------------- utilitários de tela
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Todo dado vindo do banco passa por aqui antes de entrar em innerHTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const brl = (cents) => (cents == null ? '' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

export function budgetLabel(p) {
  if (p.budget_type === 'fixed' && p.budget_min_cents != null) return brl(p.budget_min_cents);
  if (p.budget_min_cents != null && p.budget_max_cents != null) return `${brl(p.budget_min_cents)} – ${brl(p.budget_max_cents)}`;
  if (p.budget_min_cents != null) return `a partir de ${brl(p.budget_min_cents)}`;
  if (p.budget_max_cents != null) return `até ${brl(p.budget_max_cents)}`;
  return 'Orçamento a combinar';
}

export function timeAgo(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function parseBrlToCents(text) {
  const clean = String(text ?? '').replace(/[^\d,]/g, '').replace(',', '.');
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

export function showNotice(el, kind, message) {
  el.className = `notice-${kind} mt-4`;
  el.textContent = message;
  el.hidden = false;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
}

export function setBusy(button, busy, busyText = 'Aguarde…') {
  if (busy) { button.dataset.label = button.textContent; button.textContent = busyText; button.disabled = true; }
  else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; }
}

// ---------------------------------------------------------------- ícones (traço próprio, embutidos)
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h18"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4.2A2.5 2.5 0 0 1 4 13.5v-7Z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 10h18"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3Z"/><path d="m9 12 2.2 2.2L15 10.5"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  megaphone: '<path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l8 4V4.5l-8 4H5.5A1.5 1.5 0 0 0 4 10Z"/><path d="M19 9.5a3.5 3.5 0 0 1 0 5"/>',
  code: '<path d="m8.5 8-4.5 4 4.5 4M15.5 8l4.5 4-4.5 4M13.5 5l-3 14"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.7-1.5-1.7-1.5-3.2 0-1 .8-1.7 1.9-1.7h2.1a4 4 0 0 0 4-4C20.5 6 16.7 3.5 12 3.5Z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3 19.5c.6-3 2.9-4.8 6-4.8s5.4 1.8 6 4.8"/><path d="M16 5.8a3 3 0 0 1 0 5.4M18 15c1.7.6 2.7 2 3 4.5"/>',
  pen: '<path d="m4 20 1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z"/><path d="m14.5 6 3.5 3.5"/>',
  ruler: '<path d="m3.5 16.5 13-13 4 4-13 13-4-4Z"/><path d="m7.5 12.5 1.5 1.5M10.5 9.5l1.5 1.5M13.5 6.5 15 8"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M11 6H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-4"/>',
};
export const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.layers}</svg>`;

// ---------------------------------------------------------------- cabeçalho, barra de app e rodapé
const LOGO = `<a href="/" class="flex items-center gap-2.5 text-lg font-extrabold tracking-tightest" aria-label="Bico BR — página inicial">
  <span class="grid h-10 w-10 place-items-center rounded-2xl bg-mata-950 text-sol-400 shadow-glow" aria-hidden="true">
    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor"><path d="M7 3h6.2c3 0 5 1.7 5 4.3 0 1.7-.9 3-2.3 3.7 1.9.6 3.1 2.1 3.1 4.2 0 3-2.3 4.8-5.6 4.8H7V3Zm3.4 7h2.3c1.3 0 2.1-.7 2.1-1.9s-.8-1.9-2.1-1.9h-2.3V10Zm0 7h2.7c1.5 0 2.4-.8 2.4-2.1s-.9-2.1-2.4-2.1h-2.7V17Z"/></svg>
  </span>
  <span>Bico<span class="text-mata-600"> BR</span></span></a>`;

export async function mountChrome() {
  const header = $('#site-header');
  const footer = $('#site-footer');
  const here = location.pathname.replace(/\/$/, '') || '/';
  const current = (path, tipo) => (here === path && (tipo === undefined || (new URLSearchParams(location.search).get('tipo') === 'quick') === tipo) ? ' aria-current="page"' : '');
  if (footer) {
    footer.className = 'mt-16 bg-mata-950 text-white/70';
    footer.innerHTML = `
      <div class="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div><p class="text-lg font-extrabold tracking-tightest text-white">Bico<span class="text-mata-400"> BR</span></p>
          <p class="mt-3 max-w-xs text-sm">Seu próximo bico começa aqui. Trabalho remoto para empresas e profissionais de todo o Brasil.</p></div>
        <nav aria-label="Para profissionais" class="text-sm"><p class="font-bold text-white">Profissionais</p>
          <ul class="mt-3 space-y-2"><li><a class="hover:text-white" href="/projetos">Projetos freelance</a></li><li><a class="hover:text-white" href="/projetos?tipo=quick">Bico Rápido</a></li><li><a class="hover:text-white" href="/vagas">Vagas remotas</a></li></ul></nav>
        <nav aria-label="Para empresas" class="text-sm"><p class="font-bold text-white">Empresas</p>
          <ul class="mt-3 space-y-2"><li><a class="hover:text-white" href="/publicar-projeto">Publicar projeto</a></li><li><a class="hover:text-white" href="/publicar-vaga">Publicar vaga</a></li><li><a class="hover:text-white" href="/anuncie">Anuncie no Bico BR</a></li></ul></nav>
        <nav aria-label="Institucional" class="text-sm"><p class="font-bold text-white">Bico BR</p>
          <ul class="mt-3 space-y-2"><li><a class="hover:text-white" href="/confianca">Central de Confiança</a></li><li><a class="hover:text-white" href="/cadastro">Criar conta</a></li></ul></nav>
      </div>
      <div class="border-t border-white/10"><p class="wrap py-5 text-xs">© ${new Date().getFullYear()} Bico BR. Anúncios são sempre identificados como “Patrocinado”.</p></div>`;
  }
  if (!header) return;
  const session = await getSession();
  header.className = 'site-header';
  header.innerHTML = `
    <div class="wrap flex items-center justify-between gap-3 py-3">
      ${LOGO}
      <nav class="hidden items-center gap-1 md:flex" aria-label="Principal">
        <a class="nav-link" href="/projetos"${current('/projetos', false)}>Projetos</a>
        <a class="nav-link" href="/projetos?tipo=quick"${current('/projetos', true)}>Bico Rápido</a>
        <a class="nav-link" href="/vagas"${current('/vagas')}>Vagas remotas</a>
      </nav>
      <div class="flex items-center gap-1.5">
        ${session
    ? `<a class="nav-link hidden sm:inline-flex" href="/mensagens"${current('/mensagens')}>Mensagens</a><a class="btn-dark" href="/painel">Meu painel</a><button class="nav-link hidden sm:inline-flex" id="logout" type="button">Sair</button>`
    : '<a class="nav-link" href="/entrar">Entrar</a><a class="btn-primary" href="/cadastro">Criar conta</a>'}
      </div>
    </div>`;
  // barra inferior no celular: navegação de aplicativo
  if (!$('#tabbar')) {
    const tab = (href, name, label, cur) => `<a href="${href}"${cur}>${icon(name, 'icon h-[22px] w-[22px]')}<span>${label}</span></a>`;
    document.body.insertAdjacentHTML('beforeend', `<nav id="tabbar" class="tabbar" aria-label="Navegação do aplicativo">
      ${tab('/', 'home', 'Início', current('/'))}${tab('/projetos', 'layers', 'Projetos', current('/projetos'))}${tab('/vagas', 'briefcase', 'Vagas', current('/vagas'))}
      ${session ? tab('/mensagens', 'chat', 'Conversas', current('/mensagens')) + tab('/painel', 'user', 'Painel', current('/painel'))
    : tab('/entrar', 'user', 'Entrar', current('/entrar')) + tab('/cadastro', 'bolt', 'Criar conta', current('/cadastro'))}</nav>`);
    document.body.classList.add('has-tabbar');
  }
  $('#logout')?.addEventListener('click', async () => {
    const { sb } = await getClient();
    await sb?.auth.signOut();
    location.href = '/';
  });
}

/** Aviso único quando o Supabase ainda não foi configurado no servidor. */
export async function warnIfUnconfigured(target) {
  const { sb } = await getClient();
  if (!sb && target) showNotice(target, 'warn', 'Ambiente ainda sem Supabase configurado: cadastro, login e listagens ficam indisponíveis.');
  return Boolean(sb);
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
export const brlExact = (cents) => (cents == null ? '' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

/** Só seguimos para URLs http(s) devolvidas pelo nosso backend (nunca javascript:, data: etc.). */
export function goToCheckout(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Endereço de pagamento inválido.'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Endereço de pagamento inválido.');
  location.assign(parsed.href);
}

/** Mensagem segura para erros de RPC: usa o texto do banco só quando é um erro de regra de negócio. */
export function rpcMessage(error, fallback = 'Não foi possível concluir. Tente novamente.') {
  return ['P0001', 'P0002', '42501'].includes(error?.code) && error.message ? error.message : fallback;
}
