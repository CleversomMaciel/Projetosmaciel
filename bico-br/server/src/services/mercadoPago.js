import crypto from 'node:crypto';
import { requestJson } from '../lib/http.js';

/**
 * Validação da assinatura de webhooks do Mercado Pago.
 * Cabeçalho:  x-signature: ts=<timestamp>,v1=<hmac hex>
 * Manifesto:  id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * HMAC-SHA256 do manifesto com a "assinatura secreta" da aplicação.
 * data.id vem da query string (?data.id=...) e, se alfanumérico, em minúsculas.
 * Partes ausentes na notificação são omitidas do manifesto.
 */
export function parseSignatureHeader(header) {
  const parts = Object.fromEntries(
    String(header || '').split(',').map((p) => p.split('=').map((s) => s.trim())).filter((kv) => kv.length === 2),
  );
  return { ts: parts.ts || null, v1: parts.v1 || null };
}

export function buildManifest({ dataId, requestId, ts }) {
  let manifest = '';
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

export function verifyWebhookSignature({ signatureHeader, requestId, dataId, secret }) {
  if (!secret) return false;
  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const expected = crypto.createHmac('sha256', secret).update(buildManifest({ dataId, requestId, ts })).digest();
  const given = Buffer.from(v1, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Cliente mínimo: consulta o pagamento direto na API (nunca confiamos no corpo do webhook). */
export function createMercadoPagoClient({ accessToken, apiBase, fetchImpl, timeoutMs = 8000 }) {
  return {
    configured: Boolean(accessToken),
    /**
     * Cria uma preferência do Checkout Pro. O comprador paga na página do Mercado Pago;
     * nenhum dado de cartão passa pelo Bico BR. external_reference liga o pagamento ao nosso registro.
     * https://www.mercadopago.com.br/developers/pt/reference/preferences/_checkout_preferences/post
     */
    async createPreference({ paymentId, title, amountCents, payerEmail, notificationUrl, backUrl }) {
      const body = {
        items: [{ id: paymentId, title: String(title).slice(0, 250), quantity: 1, currency_id: 'BRL', unit_price: amountCents / 100 }],
        external_reference: paymentId,
        notification_url: notificationUrl,
        back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
        ...(backUrl.startsWith('https://') ? { auto_return: 'approved' } : {}),
        ...(payerEmail ? { payer: { email: payerEmail } } : {}),
        metadata: { bico_payment_id: paymentId },
      };
      const { status, json } = await requestJson(`${apiBase}/checkout/preferences`, {
        method: 'POST', body: JSON.stringify(body), timeoutMs, fetchImpl, retries: 0,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', 'x-idempotency-key': paymentId },
      });
      if (status !== 201 && status !== 200) throw new Error(`Mercado Pago respondeu HTTP ${status} ao criar a preferência`);
      const url = json?.init_point;
      if (!json?.id || typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error('Resposta inesperada do Mercado Pago');
      return { preferenceId: String(json.id), checkoutUrl: url };
    },
    async getPayment(id) {
      const { status, json } = await requestJson(`${apiBase}/v1/payments/${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${accessToken}` }, timeoutMs, fetchImpl,
      });
      if (status === 404) return null;
      if (status !== 200 || !json) throw new Error(`Mercado Pago respondeu HTTP ${status}`);
      return {
        id: String(json.id),
        status: json.status,
        statusDetail: json.status_detail ?? null,
        amountCents: Math.round(Number(json.transaction_amount) * 100),
        currency: json.currency_id,
        externalReference: json.external_reference ?? null,
      };
    },
  };
}
