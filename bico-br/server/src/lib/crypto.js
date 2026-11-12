import crypto from 'node:crypto';

/** Chave de 32 bytes a partir de MP_TOKEN_ENCRYPTION_KEY (64 caracteres hexadecimais). */
export function loadKey(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex || '')) return null;
  return Buffer.from(hex, 'hex');
}

/** AES-256-GCM: confidencialidade + integridade. Saída: base64(iv | tag | cifra). */
export function encrypt(plain, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}
export function decrypt(payload, key) {
  const raw = Buffer.from(payload, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** "state" do OAuth: liga a volta do Mercado Pago ao usuário que iniciou, com validade curta e sem cookies. */
const mac = (data, key) => crypto.createHmac('sha256', key).update(`oauth-state:${data}`).digest('base64url');
export function signState(userId, key, ttlSeconds = 900, now = Date.now()) {
  const body = `${userId}.${Math.floor(now / 1000) + ttlSeconds}`;
  return `${body}.${mac(body, key)}`;
}
export function verifyState(state, key, now = Date.now()) {
  const [userId, exp, sig] = String(state || '').split('.');
  if (!userId || !exp || !sig) return null;
  const expected = Buffer.from(mac(`${userId}.${exp}`, key));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  return Number(exp) * 1000 > now ? userId : null;
}
