import { $, esc, fmtDate, getClient, mountChrome, warnIfUnconfigured } from './core.js';

mountChrome();
const root = $('#perfil');
const AVAIL = { full_time: 'Tempo integral', part_time: 'Meio período', weekends: 'Fins de semana', unavailable: 'Indisponível no momento' };
/** Links de terceiros só viram <a> se forem http(s); abrem sem repassar referência nem autoridade de SEO. */
const safeLink = (url) => (/^https?:\/\//i.test(url ?? '') ? `<a class="linkish break-all" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow ugc">${esc(url)}</a>` : '');

(async () => {
  const slug = new URLSearchParams(location.search).get('u') ?? '';
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) { root.innerHTML = '<p>Perfil não encontrado.</p>'; return; }
  if (!(await warnIfUnconfigured(root))) return;
  const { sb } = await getClient();
  const { data: f } = await sb.from('freelancer_profiles')
    .select('user_id, slug, headline, bio, availability, tools, completed_projects, rating_avg, rating_count, profiles(display_name, city, uf)')
    .eq('slug', slug).maybeSingle();
  if (!f) { root.innerHTML = '<p>Perfil não encontrado ou não público.</p>'; return; }
  const [{ data: items }, { data: reviews }] = await Promise.all([
    sb.from('portfolio_items').select('title, description, link_url, origin, created_at').eq('user_id', f.user_id).eq('visibility', 'public').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    sb.from('reviews').select('rating, comment, created_at').eq('reviewee_id', f.user_id).eq('reviewee_role', 'freelancer').order('created_at', { ascending: false }).limit(20),
  ]);
  const name = f.profiles?.display_name || 'Profissional';
  document.title = `${name}${f.headline ? ` — ${f.headline}` : ''} | Bico BR`;
  root.innerHTML = `
    <header class="card">
      <h1 class="text-2xl font-bold tracking-tight">${esc(name)}</h1>
      <p class="text-tinta-700">${esc(f.headline)}</p>
      <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-500">
        <span>${esc([f.profiles?.city, f.profiles?.uf].filter(Boolean).join(' · '))}</span>
        ${f.availability ? `<span>${esc(AVAIL[f.availability])}</span>` : ''}
        <span>${f.completed_projects} projeto(s) concluído(s) no Bico BR</span>
        <span>${f.rating_count ? `Nota ${Number(f.rating_avg).toFixed(1)} (${f.rating_count})` : 'Ainda sem avaliações'}</span></p>
      ${f.bio ? `<p class="mt-4 whitespace-pre-line text-sm text-tinta-700">${esc(f.bio)}</p>` : ''}
      ${(f.tools ?? []).length ? `<p class="mt-4 flex flex-wrap gap-2">${f.tools.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</p>` : ''}
    </header>
    <h2 class="mt-8 text-xl font-bold tracking-tight">Portfólio</h2>
    <ul class="mt-4 grid gap-4 sm:grid-cols-2">${(items ?? []).map((i) => `<li class="card text-sm">
      ${i.origin === 'bico_br' ? '<span class="chip-sol">Projeto realizado no Bico BR</span>' : '<span class="chip">Trabalho externo, informado pelo profissional</span>'}
      <h3 class="mt-2 font-semibold">${esc(i.title)}</h3>
      ${i.description ? `<p class="mt-1 whitespace-pre-line text-tinta-700">${esc(i.description)}</p>` : ''}
      <p class="mt-2 text-xs">${safeLink(i.link_url)}</p></li>`).join('') || '<li class="text-sm text-tinta-500">Nenhum trabalho publicado.</li>'}</ul>
    <h2 class="mt-8 text-xl font-bold tracking-tight">Avaliações</h2>
    <ul class="mt-4 space-y-3">${(reviews ?? []).map((r) => `<li class="card text-sm"><strong>Nota ${r.rating}</strong> <span class="text-xs text-tinta-500">${fmtDate(r.created_at)}</span>${r.comment ? `<p class="mt-1 text-tinta-700">${esc(r.comment)}</p>` : ''}</li>`).join('') || '<li class="text-sm text-tinta-500">Ainda sem avaliações.</li>'}</ul>`;
})();
