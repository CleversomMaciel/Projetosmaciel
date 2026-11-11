import { rateLimit } from 'express-rate-limit';

/**
 * Limite por IP ou por usuário autenticado. Contadores em memória: suficiente para UMA
 * instância. Com várias instâncias atrás de balanceador, trocar por store compartilhado (Redis).
 */
export function limiter({ windowMs = 60_000, max, byUser = false }) {
  return rateLimit({
    windowMs, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req) => (byUser && req.user ? `u:${req.user.id}` : `ip:${req.ip}`),
    handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Aguarde um instante e tente de novo.' } }),
  });
}
