import { Router } from 'express';
import { verifyWebhookSignature } from '../services/mercadoPago.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Webhook do Mercado Pago. Regras:
 *  1. assinatura inválida => 401, nada é gravado;
 *  2. evento registrado de forma idempotente (repetições não reprocessam);
 *  3. o corpo NÃO é fonte de verdade: o pagamento é consultado na API do Mercado Pago;
 *  4. a mudança de estado acontece em uma única função transacional no banco, que confere
 *     o valor pago contra o valor esperado;
 *  5. erro de processamento => 500, para o Mercado Pago reenviar.
 */
export function webhookRoutes({ store, mp, config, logger }) {
  const router = Router();

  router.post('/webhooks/mercadopago', async (req, res) => {
    const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? '');
    const valid = verifyWebhookSignature({
      signatureHeader: req.get('x-signature'), requestId: req.get('x-request-id'),
      dataId, secret: config.mercadoPago.webhookSecret,
    });
    if (!valid) {
      logger.warn('webhook mercadopago com assinatura inválida', { ip: req.ip, dataId });
      return res.status(401).json({ error: { code: 'INVALID_SIGNATURE' } });
    }

    const eventType = String(req.query.type ?? req.body?.type ?? '');
    const action = String(req.body?.action ?? '');
    const dedupeKey = `${eventType}:${dataId}:${action}`;
    try {
      const state = await store.registerWebhookEvent({
        provider: 'mercadopago', dedupeKey, eventType, action, resourceId: dataId, payload: req.body ?? {},
      });
      if (state === 'done') return res.status(200).json({ ok: true, duplicate: true });
      if (eventType !== 'payment') {
        await store.finishWebhookEvent({ provider: 'mercadopago', dedupeKey });
        return res.status(200).json({ ok: true, ignored: eventType });
      }

      const payment = await mp.getPayment(dataId);
      let outcome = 'payment_not_found_at_provider';
      if (payment) {
        if (!UUID.test(payment.externalReference || '')) outcome = 'no_external_reference';
        else if (payment.currency && payment.currency !== 'BRL') outcome = 'unexpected_currency';
        else {
          outcome = await store.processPaymentUpdate({
            paymentId: payment.externalReference, providerPaymentId: payment.id,
            status: payment.status, statusDetail: payment.statusDetail, amountCents: payment.amountCents,
          });
        }
      }
      if (['amount_mismatch', 'unexpected_currency', 'payment_not_found', 'approved_needs_refund', 'provider_id_conflict'].includes(outcome)) {
        logger.error('webhook mercadopago requer conferência manual', { outcome, dataId });
      }
      await store.finishWebhookEvent({ provider: 'mercadopago', dedupeKey });
      return res.status(200).json({ ok: true, outcome });
    } catch (err) {
      logger.error('falha ao processar webhook mercadopago', { err, dataId });
      await store.finishWebhookEvent({ provider: 'mercadopago', dedupeKey, error: err.message }).catch(() => {});
      return res.status(500).json({ error: { code: 'PROCESSING_FAILED' } });
    }
  });

  return router;
}
