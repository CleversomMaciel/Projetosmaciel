import { Router } from 'express';

const xml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

export function seoRoutes({ store, config, logger }) {
  const router = Router();
  let cache = { body: null, expiresAt: 0 };

  router.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send([
      'User-agent: *',
      'Allow: /',
      // áreas privadas: nunca indexar
      'Disallow: /api/',
      'Disallow: /painel',
      'Disallow: /admin',
      'Disallow: /mensagens',
      'Disallow: /contratos',
      'Disallow: /entrar',
      'Disallow: /cadastro',
      'Disallow: /onboarding',
      '',
      `Sitemap: ${config.publicUrl}/sitemap.xml`,
      '',
    ].join('\n'));
  });

  router.get('/sitemap.xml', async (_req, res) => {
    try {
      if (!cache.body || cache.expiresAt < Date.now()) {
        const base = config.publicUrl;
        const urls = [
          { loc: `${base}/` }, { loc: `${base}/projetos` }, { loc: `${base}/vagas` },
        ];
        if (store?.sitemapEntries) {
          const e = await store.sitemapEntries();
          for (const c of e.categories) urls.push({ loc: `${base}/projetos?categoria=${encodeURIComponent(c.slug)}`, lastmod: c.updated_at });
          for (const p of e.projects) urls.push({ loc: `${base}/projeto?id=${p.id}`, lastmod: p.updated_at });
          // Páginas individuais de vaga e de profissional entram aqui quando existirem
          // (profissionais: somente quem autorizou exposição pública — is_public).
        }
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
          urls.slice(0, 50000).map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${xml(String(u.lastmod).slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')
        }\n</urlset>\n`;
        cache = { body, expiresAt: Date.now() + 10 * 60_000 };
      }
      res.type('application/xml').send(cache.body);
    } catch (err) {
      logger.error('falha ao gerar sitemap', { err });
      res.status(503).type('text/plain').send('sitemap indisponível');
    }
  });

  return router;
}
