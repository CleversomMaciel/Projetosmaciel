import { Router } from 'express';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { limiter } from '../middleware/rateLimit.js';
import { sellerAccessToken } from '../services/sellerToken.js';

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inicia o pagamento de uma cobrança JÁ criada pelo banco (entrada de contrato ou plano Pro).
 * O valor nunca vem do navegador: é lido do registro. Só o pagador da cobrança pode iniciá-la.
 * A confirmação NÃO acontece aqui nem no retorno do navegador — só pelo webhook validado.
 */
export function paymentRoutes({ store, mp, auth, config, key }) {
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
    // o webhook recebe a referência para saber com qual conta consultar o pagamento; ela é conferida de novo lá
    const notificationUrl = `${config.publicUrl}/api/webhooks/mercadopago?ref=${payment.id}`;
    let created;
    if (isPlan) {
      created = await mp.createPreference({
        paymentId: payment.id, title: `${payment.plans?.name ?? 'Bico BR Pro'} — 30 dias (sem renovação automática)`,
        amountCents: payment.amount_cents, payerEmail: req.user.email, notificationUrl, backUrl: `${config.publicUrl}/plano`,
      });
    } else {
      // Projeto: pagamento dividido. O Mercado Pago credita o profissional e separa a taxa do Bico BR.
      const seller = await sellerAccessToken({ store, mp, key, userId: payment.contracts?.freelancer_id });
      if (!seller) throw conflict('SELLER_NOT_CONNECTED', 'O profissional ainda não conectou a conta do Mercado Pago. Avise-o pelo chat.');
      created = await mp.createPreference({
        paymentId: payment.id, title: `Projeto no Bico BR — ${payment.contracts?.projects?.title ?? 'contrato'}`,
        amountCents: payment.amount_cents, payerEmail: req.user.email, notificationUrl,
        backUrl: `${config.publicUrl}/contrato?id=${payment.contract_id}`,
        sellerAccessToken: seller, marketplaceFeeCents: payment.contracts.deposit_cents,
      });
    }
    await store.saveCheckout(payment.id, created);
    return res.json({ checkoutUrl: created.checkoutUrl });
  }));

  return router;
}
