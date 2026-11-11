import { Router } from 'express';
import { limiter } from '../middleware/rateLimit.js';

// Todo dado do banco passa por estas funções antes de entrar no HTML.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON-LD dentro de <script>: "<" escapado impede fechar a tag com </script>.
const LINE_SEPARATORS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c').replace(LINE_SEPARATORS, '')}</script>`;
const clip = (text, n) => { const t = String(text ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };
const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Troca título, descrição, canonical e Open Graph; opcionalmente injeta conteúdo e JSON-LD. */
export function applySeo(html, { title, description, canonical, noindex = false, ld = null, inject = null }) {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(canonical)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, noindex ? '<meta name="robots" content="noindex, follow">' : `<link rel="canonical" href="${esc(canonical)}">`);
  if (ld) out = out.replace('</head>', `  ${jsonLd(ld)}\n</head>`);
  if (inject) out = out.replace(inject.marker, () => inject.html);
  return out;
}

/**
 * Páginas públicas pré-renderizadas: o buscador recebe título, descrição e o texto principal
 * sem depender de JavaScript. Em seguida o script da página assume e monta a versão interativa.
 * Leitura sempre pelo papel anônimo (RLS decide o que é público).
 */
export function publicPageRoutes({ store, config, logger, renderPage }) {
  const router = Router();
  const html = (res, status, body, noindex) => {
    if (noindex) res.set('x-robots-tag', 'noindex, follow');
    res.status(status).type('html').set('cache-control', 'public, max-age=60').send(body);
  };
  const safe = (handler) => async (req, res, next) => {
    if (!store?.public) return next();
    try { await handler(req, res, next); } catch (err) { logger.warn('pré-renderização falhou; servindo página sem dados', { err, path: req.path }); next(); }
  };
  router.use(['/projeto', '/profissional', '/projetos'], limiter({ max: 120 }));

  router.get('/projeto', safe(async (req, res) => {
    const id = String(req.query.id ?? '');
    const p = UUID.test(id) ? await store.public.project(id) : null;
    if (!p) return html(res, 404, applySeo(renderPage('projeto'), { title: 'Projeto não encontrado — Bico BR', description: 'Este projeto não está disponível.', canonical: `${config.publicUrl}/projetos`, noindex: true }), true);
    const budget = p.budget_min_cents != null && p.budget_max_cents != null && p.budget_type !== 'fixed' ? `${brl(p.budget_min_cents)} a ${brl(p.budget_max_cents)}`
      : p.budget_min_cents != null ? brl(p.budget_min_cents) : 'a combinar';
    const closed = p.status !== 'open'; // projeto encerrado continua acessível, mas sai do índice
    return html(res, 200, applySeo(renderPage('projeto'), {
      title: clip(`${p.title} — ${p.kind === 'quick' ? 'Bico Rápido' : 'Projeto freelance remoto'} | Bico BR`, 70),
      description: clip(`${p.categories?.name ?? 'Projeto'} · orçamento ${budget}. ${p.description}`, 160),
      canonical: `${config.publicUrl}/projeto?id=${p.id}`, noindex: closed,
      inject: {
        marker: '<p class="text-sm text-tinta-500">Carregando…</p>',
        html: `<p class="chip">${esc(p.categories?.name)}</p><h1 class="mt-3 text-2xl font-bold tracking-tight">${esc(p.title)}</h1>`
          + `<p class="mt-2 text-sm text-tinta-500">${esc(p.companies?.display_name)} · Orçamento ${esc(budget)}${p.deadline_days ? ` · Prazo ${p.deadline_days} dias` : ''} · 100% remoto</p>`
          + `<p class="mt-4 whitespace-pre-line text-sm text-tinta-700">${esc(p.description)}</p>`,
      },
    }), closed);
  }));

  router.get('/profissional', safe(async (req, res) => {
    const slug = String(req.query.u ?? '');
    const f = /^[a-z0-9-]{3,60}$/.test(slug) ? await store.public.freelancer(slug) : null;
    // papel anon só enxerga perfis com is_public = true: quem não autorizou exposição nunca chega aqui
    if (!f) return html(res, 404, applySeo(renderPage('profissional'), { title: 'Perfil não encontrado — Bico BR', description: 'Este perfil não está disponível.', canonical: `${config.publicUrl}/`, noindex: true }), true);
    const name = f.profiles?.display_name || 'Profissional';
    const place = [f.profiles?.city, f.profiles?.uf].filter(Boolean).join(', ');
    return html(res, 200, applySeo(renderPage('profissional'), {
      title: clip(`${name}${f.headline ? ` — ${f.headline}` : ''} | Bico BR`, 70),
      description: clip(`${f.headline ?? 'Profissional remoto'}${place ? ` em ${place}` : ''}. ${f.bio ?? ''}`, 160),
      canonical: `${config.publicUrl}/profissional?u=${f.slug}`,
      ld: {
        '@context': 'https://schema.org', '@type': 'ProfilePage', dateModified: f.updated_at,
        mainEntity: { '@type': 'Person', name, jobTitle: f.headline ?? undefined, description: clip(f.bio, 300) || undefined,
          address: place ? { '@type': 'PostalAddress', addressLocality: f.profiles?.city ?? undefined, addressRegion: f.profiles?.uf ?? undefined, addressCountry: 'BR' } : undefined,
          knowsAbout: (f.tools ?? []).slice(0, 20) },
      },
      inject: {
        marker: '<p class="text-sm text-tinta-500">Carregando…</p>',
        html: `<h1 class="text-2xl font-bold tracking-tight">${esc(name)}</h1><p class="text-tinta-700">${esc(f.headline)}</p>`
          + `<p class="mt-2 text-sm text-tinta-500">${esc(place)}</p><p class="mt-4 whitespace-pre-line text-sm text-tinta-700">${esc(f.bio)}</p>`,
      },
    }), false);
  }));

  // Página de categoria: /projetos?categoria=slug ganha título e descrição próprios (administráveis no banco).
  router.get('/projetos', safe(async (req, res, next) => {
    const slug = String(req.query.categoria ?? '');
    const hasOther = Boolean(req.query.q || req.query.tipo);
    if (!slug) {
      if (!hasOther) return next();
      // combinações de busca/filtro não são indexadas (evita páginas duplicadas em massa)
      return html(res, 200, applySeo(renderPage('projetos'), { title: 'Projetos remotos — Bico BR', description: 'Projetos freelance remotos no Bico BR.', canonical: `${config.publicUrl}/projetos`, noindex: true }), true);
    }
    const c = /^[a-z0-9-]{2,80}$/.test(slug) ? await store.public.category(slug) : null;
    if (!c) return html(res, 404, applySeo(renderPage('projetos'), { title: 'Área não encontrada — Bico BR', description: 'Esta área não existe.', canonical: `${config.publicUrl}/projetos`, noindex: true }), true);
    return html(res, 200, applySeo(renderPage('projetos'), {
      title: clip(c.seo_title || `Projetos remotos de ${c.name} | Bico BR`, 70),
      description: clip(c.seo_description || `Projetos freelance remotos de ${c.name}. ${c.description ?? ''}`, 160),
      canonical: `${config.publicUrl}/projetos?categoria=${c.slug}`, noindex: hasOther,
      inject: { marker: '>Projetos remotos</h1>', html: `>Projetos remotos de ${esc(c.name)}</h1>\n      <p class="mt-2 max-w-2xl text-sm text-tinta-700">${esc(c.description)}</p>` },
    }), hasOther);
  }));

  return router;
}
