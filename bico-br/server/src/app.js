import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import express from 'express';
import helmet from 'helmet';
import { AppError } from './lib/errors.js';
import { requireAuth } from './middleware/auth.js';
import { limiter } from './middleware/rateLimit.js';
import { lookupRoutes } from './routes/lookup.js';
import { companyRoutes } from './routes/companies.js';
import { webhookRoutes } from './routes/webhooks.js';
import { paymentRoutes } from './routes/payments.js';
import { seoRoutes } from './routes/seo.js';
import { publicPageRoutes } from './routes/publicPages.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '../../web');
const require = createRequire(import.meta.url);

// páginas privadas: servidas normalmente, mas marcadas para não indexar
const PRIVATE_PAGES = new Set(['entrar', 'cadastro', 'onboarding', 'painel', 'publicar-projeto', 'publicar-vaga', 'contrato', 'plano', 'mensagens', 'admin', 'perfil']);
const PUBLIC_PAGES = new Set(['index', 'projetos', 'projeto', 'vagas', 'confianca', 'profissional']);

export function createApp({ config, store, registries, mp, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  const supabaseOrigin = config.supabase.url ? new URL(config.supabase.url).origin : null;
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', ...(supabaseOrigin ? [supabaseOrigin] : [])],
        connectSrc: ["'self'", ...(supabaseOrigin ? [supabaseOrigin, supabaseOrigin.replace(/^http/, 'ws')] : [])],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(express.json({ limit: '100kb' }));

  const auth = requireAuth(store);
  const api = express.Router();
  api.use(limiter({ max: 300 })); // teto geral por IP
  api.use((_req, res, next) => { res.set('cache-control', 'no-store'); res.set('x-robots-tag', 'noindex'); next(); });
  api.get('/health', (_req, res) => res.json({ ok: true, env: config.env }));
  // Somente valores públicos. A service role key e segredos de terceiros nunca saem do servidor.
  api.get('/config', (_req, res) => res.json({
    supabaseUrl: config.supabase.url || null, supabaseAnonKey: config.supabase.anonKey || null,
    allowPfContractors: config.features.allowPfContractors,
  }));
  api.use(lookupRoutes({ registries, auth }));
  api.use(companyRoutes({ store, registries, auth, config }));
  api.use(paymentRoutes({ store, mp, auth, config }));
  api.use(webhookRoutes({ store, mp, config, logger }));
  api.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } }));
  app.use('/api', api);

  app.use(seoRoutes({ store, config, logger }));

  // cliente Supabase servido localmente (sem CDN de terceiros => CSP restrita a 'self')
  const supabaseJs = require.resolve('@supabase/supabase-js/dist/umd/supabase.js');
  app.get('/vendor/supabase.js', (_req, res) => res.sendFile(supabaseJs, { maxAge: '7d' }));

  // HTML passa por um template mínimo ({{PUBLIC_URL}} em canonical/Open Graph/JSON-LD)
  const pageCache = new Map();
  const renderPage = (name) => {
    if (config.env === 'production' && pageCache.has(name)) return pageCache.get(name);
    const html = fs.readFileSync(path.join(webDir, `${name}.html`), 'utf8').replaceAll('{{PUBLIC_URL}}', config.publicUrl);
    pageCache.set(name, html);
    return html;
  };
  const sendPage = (name, status = 200) => (req, res, next) => {
    try {
      if (PRIVATE_PAGES.has(name) || status === 404) res.set('x-robots-tag', 'noindex, nofollow');
      res.status(status).type('html').set('cache-control', 'no-cache').send(renderPage(name));
    } catch (err) { next(err.code === 'ENOENT' ? undefined : err); }
  };
  app.use(publicPageRoutes({ store, config, logger, renderPage }));
  app.get(['/', '/index.html'], sendPage('index'));
  app.get('/:page', (req, res, next) => {
    const page = req.params.page.replace(/\.html$/, '');
    if (!PRIVATE_PAGES.has(page) && !PUBLIC_PAGES.has(page)) return next();
    return sendPage(page)(req, res, next);
  });
  app.use(express.static(webDir, { index: false, maxAge: config.env === 'production' ? '1h' : 0 }));
  app.use(sendPage('404', 404));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
    }
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ error: { code: 'BAD_BODY', message: 'Corpo da requisição inválido' } });
    }
    logger.error('erro não tratado', { err, path: req.path, method: req.method });
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno. Tente novamente.' } });
  });

  return app;
}
