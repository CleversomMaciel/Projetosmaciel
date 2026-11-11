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

// ---------------------------------------------------------------- cabeçalho e rodapé
export async function mountChrome() {
  const header = $('#site-header');
  const footer = $('#site-footer');
  if (footer) {
    footer.innerHTML = `
      <div class="wrap flex flex-col gap-4 py-10 text-sm text-tinta-500 sm:flex-row sm:items-center sm:justify-between">
        <p><strong class="text-tinta">Bico BR</strong> — Seu próximo bico começa aqui.</p>
        <nav class="flex flex-wrap gap-x-5 gap-y-2" aria-label="Rodapé">
          <a class="hover:text-tinta" href="/projetos">Projetos</a>
          <a class="hover:text-tinta" href="/vagas">Vagas remotas</a>
          <a class="hover:text-tinta" href="/confianca">Central de Confiança</a>
        </nav>
      </div>`;
  }
  if (!header) return;
  const session = await getSession();
  const links = session
    ? `<a class="btn-ghost" href="/painel">Meu painel</a><button class="btn text-tinta-500 hover:text-tinta" id="logout" type="button">Sair</button>`
    : `<a class="btn text-tinta hover:text-mata-700" href="/entrar">Entrar</a><a class="btn-primary" href="/cadastro">Criar conta</a>`;
  header.innerHTML = `
    <div class="wrap flex items-center justify-between gap-3 py-3">
      <a href="/" class="flex items-center gap-2 text-lg font-extrabold tracking-tight" aria-label="Bico BR — página inicial">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-mata-600 text-sol-400" aria-hidden="true">B</span>
        <span>Bico<span class="text-mata-600"> BR</span></span>
      </a>
      <nav class="hidden items-center gap-6 text-sm font-medium text-tinta-700 md:flex" aria-label="Principal">
        <a class="hover:text-mata-700" href="/projetos">Projetos</a>
        <a class="hover:text-mata-700" href="/projetos?tipo=quick">Bico Rápido</a>
        <a class="hover:text-mata-700" href="/vagas">Vagas remotas</a>
      </nav>
      <div class="flex items-center gap-1 sm:gap-2">${links}</div>
    </div>
    <nav class="wrap flex gap-5 overflow-x-auto pb-2 text-sm font-medium text-tinta-700 md:hidden" aria-label="Principal (móvel)">
      <a class="whitespace-nowrap" href="/projetos">Projetos</a>
      <a class="whitespace-nowrap" href="/projetos?tipo=quick">Bico Rápido</a>
      <a class="whitespace-nowrap" href="/vagas">Vagas remotas</a>
    </nav>`;
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
