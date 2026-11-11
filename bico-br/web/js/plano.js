import { $, api, brlExact, esc, fmtDate, getClient, goToCheckout, mountChrome, requireSession, rpcMessage, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');

(async () => {
  await requireSession();
  const { sb } = await getClient();
  const [{ data: billing }, { data: plans }] = await Promise.all([
    sb.from('freelancer_billing').select('state, proposals_used, cycle_end, plans(name, proposals_per_cycle)').maybeSingle(),
    sb.from('plans').select('code, name, proposals_per_cycle, price_cents, cycle_days').eq('audience', 'freelancer').order('sort_order'),
  ]);
  if (!billing) return showNotice(aviso, 'warn', 'Os planos Pro são para contas de profissional.');

  const active = ['PRO_ACTIVE', 'PRO_CANCELLED'].includes(billing.state) && new Date(billing.cycle_end) > new Date();
  const canBuy = ['FIRST_PROJECT_COMPLETED', 'PRO_EXPIRED'].includes(billing.state) || (['PRO_ACTIVE', 'PRO_CANCELLED'].includes(billing.state) && !active);
  const estado = $('#estado');
  if (billing.state === 'PRO_PENDING_ACTIVATION') {
    estado.innerHTML = `<div class="card space-y-3"><p class="text-sm">Você tem uma compra aguardando pagamento. O plano é ativado quando o Mercado Pago confirmar.</p>
      <div class="flex flex-wrap gap-2"><button class="btn-primary" id="continuar" type="button">Continuar pagamento</button><button class="btn-ghost" id="desistir" type="button">Desistir da compra</button></div></div>`;
    $('#continuar').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      const { data, error } = await sb.rpc('request_pro', { p_plan_code: 'pro', p_accept: true }); // devolve a cobrança pendente existente
      if (error) { ev.target.disabled = false; return showNotice(aviso, 'error', rpcMessage(error)); }
      try { goToCheckout((await api(`/payments/${data.id}/checkout`, { method: 'POST', body: {} })).checkoutUrl); }
      catch (err) { ev.target.disabled = false; showNotice(aviso, 'error', err.message); }
    });
    $('#desistir').addEventListener('click', async () => {
      const { error } = await sb.rpc('abandon_pro_request');
      if (error) return showNotice(aviso, 'error', rpcMessage(error));
      location.reload();
    });
  } else if (active) {
    estado.innerHTML = `<p class="notice-info">Plano ${esc(billing.plans?.name)} ativo até ${fmtDate(billing.cycle_end)} — ${billing.proposals_used} de ${billing.plans?.proposals_per_cycle} propostas usadas. Ele não renova sozinho.</p>`;
  } else if (!canBuy) {
    estado.innerHTML = '<p class="notice-info">Você ainda envia propostas sem limite. Os planos ficam disponíveis depois que o seu primeiro projeto for concluído e aprovado.</p>';
  }

  $('#planos').innerHTML = (plans ?? []).map((p) => `
    <div class="card flex flex-col">
      <h2 class="font-semibold">${esc(p.name)}</h2>
      <p class="mt-2 text-3xl font-extrabold tracking-tight">${brlExact(p.price_cents)}</p>
      <p class="text-xs text-tinta-500">pagamento único · vale ${p.cycle_days} dias</p>
      <p class="mt-3 text-sm">${p.proposals_per_cycle} propostas no período</p>
      ${canBuy ? `<button class="btn-ghost mt-4" type="button" data-plan="${esc(p.code)}">Escolher</button>` : ''}
    </div>`).join('') || '<p class="text-sm text-tinta-500">Nenhum plano disponível no momento.</p>';

  let chosen = null;
  $('#planos').addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-plan]');
    if (!el) return;
    chosen = plans.find((p) => p.code === el.dataset.plan);
    $('#resumo').textContent = `${chosen.name}: ${brlExact(chosen.price_cents)} em pagamento único, ${chosen.proposals_per_cycle} propostas, válido por ${chosen.cycle_days} dias a partir da confirmação do pagamento. Sem renovação automática.`;
    $('#aceite').checked = false;
    $('#compra').hidden = false;
    $('#compra').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('#compra').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!chosen) return;
    if (!$('#aceite').checked) return showNotice(aviso, 'error', 'Marque a autorização para continuar.');
    ev.submitter.disabled = true;
    const { data, error } = await sb.rpc('request_pro', { p_plan_code: chosen.code, p_accept: true });
    if (error) { ev.submitter.disabled = false; return showNotice(aviso, 'error', rpcMessage(error)); }
    try { goToCheckout((await api(`/payments/${data.id}/checkout`, { method: 'POST', body: {} })).checkoutUrl); }
    catch (err) { showNotice(aviso, 'warn', `${err.message} Sua compra ficou registrada como pendente.`); setTimeout(() => location.reload(), 2500); }
  });
})();
