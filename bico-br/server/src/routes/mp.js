import { Router } from 'express';
import { AppError, forbidden } from '../lib/errors.js';
import { encrypt, signState, verifyState } from '../lib/crypto.js';
import { limiter } from '../middleware/rateLimit.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

/**
 * Conexão da conta Mercado Pago do profissional (OAuth). É o que permite ao Mercado Pago pagar
 * a parte dele diretamente, sem o dinheiro passar pelo Bico BR.
 */
export function mpRoutes({ store, mp, auth, config, key, logger }) {
  const router = Router();
  const redirectUri = `${config.publicUrl}/api/mp/callback`;

  router.get('/mp/connect', auth, limiter({ max: 10, byUser: true }), wrap(async (req, res) => {
    if (!mp.marketplaceConfigured || !key) throw new AppError(503, 'MP_MARKETPLACE_DISABLED', 'A conexão com o Mercado Pago ainda não está habilitada neste ambiente.');
    const profile = await store.getProfile(req.user.id);
    if (profile?.account_type !== 'freelancer') throw forbidden('Somente profissionais conectam conta para receber.');
    const url = new URL(config.mercadoPago.authUrl);
    url.searchParams.set('client_id', config.mercadoPago.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('platform_id', 'mp');
    url.searchParams.set('state', signState(req.user.id, key));
    url.searchParams.set('redirect_uri', redirectUri);
    res.json({ url: url.toString() });
  }));

  // Volta do Mercado Pago: sem cabeçalho de login; a identidade vem do "state" assinado e com validade curta.
  router.get('/mp/callback', limiter({ max: 20 }), wrap(async (req, res) => {
    const userId = key ? verifyState(req.query.state, key) : null;
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!userId || !code || code.length > 300) return res.redirect(303, '/perfil?mp=erro');
    try {
      const t = await mp.exchangeCode(code, redirectUri);
      await store.saveMpAccount(userId, {
        mpUserId: t.mpUserId, accessTokenEnc: encrypt(t.accessToken, key),
        refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken, key) : null, expiresAt: t.expiresAt,
      });
      return res.redirect(303, '/perfil?mp=ok');
    } catch (err) {
      logger.error('falha ao conectar conta Mercado Pago', { err, userId });
      return res.redirect(303, '/perfil?mp=erro');
    }
  }));

  return router;
}
