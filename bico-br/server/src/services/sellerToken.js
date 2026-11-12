import { decrypt, encrypt } from '../lib/crypto.js';

/** Token de acesso da conta Mercado Pago do profissional, renovado quando está perto de vencer. */
export async function sellerAccessToken({ store, mp, key, userId }) {
  const acc = await store.getMpAccount(userId);
  if (!acc || !key) return null;
  const soon = acc.expires_at && new Date(acc.expires_at).getTime() < Date.now() + 7 * 86400000;
  if (soon && acc.refresh_token_enc) {
    const fresh = await mp.refreshToken(decrypt(acc.refresh_token_enc, key));
    await store.saveMpAccount(userId, {
      mpUserId: fresh.mpUserId || acc.mp_user_id, accessTokenEnc: encrypt(fresh.accessToken, key),
      refreshTokenEnc: fresh.refreshToken ? encrypt(fresh.refreshToken, key) : acc.refresh_token_enc, expiresAt: fresh.expiresAt,
    });
    return fresh.accessToken;
  }
  return decrypt(acc.access_token_enc, key);
}
