import { Router } from 'express';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { limiter } from '../middleware/rateLimit.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inicia o pagamento de uma cobrança JÁ criada pelo banco (entrada de contrato ou plano Pro).
 * O valor nunca vem do navegador: é lido do registro. Só o pagador da cobrança pode iniciá-la.
 * A confirmação NÃO acontece aqui nem no retorno do navegador — só pelo webhook validado.
 */
export function paymentRoutes({ store, mp, auth, config }) {
  const router = Router();

  router.post('/payments/:id/checkout', auth, limiter({ max: 10, byUser: true }), wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) throw badRequest('PAYMENT_INVALID', 'Cobrança inválida.');
    const payment = await store.getPaymentForCheckout(req.params.id);
    // mesma resposta para "não existe" e "não é sua": não revela a existência de cobranças alheias
    if (!payment || payment.payer_id !== req.user.id) throw notFound('PAYMENT_NOT_FOUND', 'Cobrança não encontrada.');
    if (payment.status !== 'pending') throw conflict('PAYMENT_NOT_PENDING', 'Esta cobrança não está mais pendente.');
    if (!mp.configured) throw new AppError(503, 'PAYMENTS_DISABLED', 'Pagamento online ainda não está habilitado neste ambiente.');
    if (payment.checkout_url) return res.json({ checkoutUrl: payment.checkout_url });

    const isPlan = payment.kind === 'subscription';
    const title = isPlan
      ? `${payment.plans?.name ?? 'Plano Bico BR Pro'} — 30 dias (sem renovação automática)`
      : `Taxa de serviço Bico BR — ${payment.contracts?.projects?.title ?? 'contrato'}`;
    const backUrl = isPlan ? `${config.publicUrl}/plano` : `${config.publicUrl}/contrato?id=${payment.contract_id}`;
    const created = await mp.createPreference({
      paymentId: payment.id, title, amountCents: payment.amount_cents, payerEmail: req.user.email,
      notificationUrl: `${config.publicUrl}/api/webhooks/mercadopago`, backUrl,
    });
    await store.saveCheckout(payment.id, created);
    return res.json({ checkoutUrl: created.checkoutUrl });
  }));

  return router;
}
