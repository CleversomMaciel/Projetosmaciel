import { unauthorized } from '../lib/errors.js';

/** Exige "Authorization: Bearer <JWT do Supabase>" e valida o token no Supabase Auth. */
export function requireAuth(store) {
  return async (req, _res, next) => {
    try {
      const header = req.get('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) throw unauthorized();
      const user = await store.getUserFromToken(token);
      if (!user) throw unauthorized('Sessão inválida ou expirada');
      req.user = user;
      next();
    } catch (err) { next(err); }
  };
}
