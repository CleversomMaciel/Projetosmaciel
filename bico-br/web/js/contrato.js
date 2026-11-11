import { $, api, brlExact, esc, fmtDate, fmtDateTime, getClient, goToCheckout, mountChrome, requireSession, rpcMessage, showNotice } from './core.js';

mountChrome();
const id = new URLSearchParams(location.search).get('id') ?? '';
const aviso = $('#aviso');
const root = $('#contrato');
const STATUS = {
  awaiting_freelancer: 'Aguardando confirmação do profissional', awaiting_deposit: 'Aguardando pagamento da taxa de serviço',
  active: 'Em execução', delivered: 'Entregue — aguardando aprovação', completed: 'Concluído', cancelled: 'Cancelado',
  disputed: 'Em análise na Central de Confiança',
};
const EVENT = {
  proposal_accepted: 'Proposta aceita pela empresa', freelancer_confirmed: 'Contrato confirmado pelo profissional',
  contract_started: 'Taxa de serviço confirmada — execução iniciada', delivered: 'Entrega registrada',
  changes_requested: 'Ajustes solicitados', approved: 'Entrega aprovada', cancelled: 'Contrato cancelado',
  dispute_opened: 'Solicitação aberta na Central de Confiança', dispute_resolved: 'Solicitação encerrada',
  balance_declared_paid: 'Empresa declarou o pagamento do saldo', balance_confirmed: 'Profissional confirmou o recebimento do saldo',
  payment_refunded: 'Pagamento estornado', payment_charged_back: 'Pagamento contestado', payment_in_mediation: 'Pagamento em mediação',
};
const REASONS = { nao_entrega: 'Não houve entrega', entrega_fora_do_escopo: 'Entrega fora do combinado', atraso: 'Atraso', nao_pagamento: 'Saldo não foi pago', comunicacao: 'Falta de resposta', outro: 'Outro motivo' };

(async () => {
  const session = await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(id)) { root.innerHTML = '<p>Contrato não encontrado.</p>'; return; }
  const { sb } = await getClient();
  const uid = session.user.id;

  const [{ data: c }, { data: events }, { data: payments }, { data: reviews }, { data: disputes }] = await Promise.all([
    sb.from('contracts').select('*, projects(id, title)').eq('id', id).maybeSingle(),
    sb.from('contract_events').select('event, note, created_at').eq('contract_id', id).order('created_at'),
    sb.from('payments').select('id, kind, status, amount_cents').eq('contract_id', id),
    sb.from('reviews').select('reviewer_id, rating, comment').eq('contract_id', id),
    sb.from('disputes').select('id, protocol, status, reason, description, resolution, created_at, dispute_entries(body, author_id, created_at)').eq('contract_id', id).order('created_at', { ascending: false }),
  ]);
  if (!c) { root.innerHTML = '<p>Contrato não encontrado.</p>'; return; }

  const isCompany = c.company_user_id === uid;
  const isFreela = c.freelancer_id === uid;
  const deposit = (payments ?? []).find((p) => p.kind === 'deposit');
  const myReview = (reviews ?? []).find((r) => r.reviewer_id === uid);
  const openDispute = (disputes ?? []).find((d) => !['resolved', 'closed'].includes(d.status));
  document.title = `Contrato: ${c.projects?.title ?? ''} — Bico BR`;

  const btn = (label, action, style = 'btn-primary') => `<button class="${style}" type="button" data-action="${action}">${label}</button>`;
  const noteForm = (action, label, placeholder, min = 10) => `
    <form class="space-y-2" data-form="${action}" novalidate>
      <label class="label" for="n-${action}">${label}</label>
      <textarea class="input" id="n-${action}" rows="3" minlength="${min}" maxlength="3000" placeholder="${placeholder}" required></textarea>
      <button class="btn-ghost" type="submit">${label}</button>
    </form>`;

  let actions = '';
  if (c.status === 'awaiting_freelancer') {
    actions = isFreela
      ? `<p class="text-sm">Confira escopo, valor e prazo. Ao confirmar, a empresa é avisada para pagar a taxa de serviço e o trabalho começa quando o pagamento for confirmado.</p><div class="flex flex-wrap gap-2">${btn('Confirmar contrato', 'confirm_contract')}${btn('Recusar', 'cancel_contract', 'btn-ghost')}</div>`
      : `<p class="text-sm text-tinta-500">Aguardando o profissional confirmar o contrato.</p>${btn('Cancelar contrato', 'cancel_contract', 'btn-ghost')}`;
  } else if (c.status === 'awaiting_deposit') {
    actions = isCompany
      ? `<p class="text-sm">Pague a taxa de serviço de <strong>${brlExact(c.deposit_cents)}</strong> para iniciar. O pagamento é feito na página do Mercado Pago; o contrato só inicia quando o Mercado Pago confirmar.</p><div class="flex flex-wrap gap-2">${deposit?.status === 'pending' ? btn('Pagar taxa de serviço', 'pay') : '<span class="chip">Pagamento em processamento</span>'}${btn('Cancelar contrato', 'cancel_contract', 'btn-ghost')}</div>`
      : '<p class="text-sm text-tinta-500">Aguardando a empresa pagar a taxa de serviço. Não comece o trabalho antes da confirmação.</p>';
  } else if (c.status === 'active') {
    actions = isFreela ? noteForm('deliver_contract', 'Registrar entrega', 'Descreva o que foi entregue e onde estão os arquivos.')
      : `<p class="text-sm text-tinta-500">Em execução. Prazo combinado: ${fmtDate(c.due_at)}.</p>`;
  } else if (c.status === 'delivered') {
    actions = isCompany ? `<div class="flex flex-wrap gap-2">${btn('Aprovar entrega', 'approve_delivery')}</div>${noteForm('request_changes', 'Pedir ajustes', 'O que precisa ser ajustado?')}`
      : '<p class="text-sm text-tinta-500">Entrega enviada. Aguardando a análise da empresa.</p>';
  } else if (c.status === 'completed') {
    const saldo = c.balance_confirmed_at ? '<p class="notice-info">Saldo pago e recebimento confirmado.</p>'
      : c.balance_declared_paid_at
        ? (isFreela ? `<p class="text-sm">A empresa declarou ter pago o saldo de <strong>${brlExact(c.balance_cents)}</strong> em ${fmtDate(c.balance_declared_paid_at)}.</p>${btn('Confirmar que recebi', 'confirm_balance_received')}` : '<p class="text-sm text-tinta-500">Aguardando o profissional confirmar o recebimento do saldo.</p>')
        : (isCompany ? `<p class="text-sm">Pague o saldo de <strong>${brlExact(c.balance_cents)}</strong> diretamente ao profissional e registre aqui.</p>${btn('Já paguei o saldo', 'declare_balance_paid')}` : `<p class="text-sm text-tinta-500">Aguardando a empresa pagar o saldo de ${brlExact(c.balance_cents)} diretamente a você. Se não receber, abra uma solicitação abaixo.</p>`);
    const review = myReview ? `<p class="text-sm text-tinta-500">Você avaliou com nota ${myReview.rating}.</p>` : `
      <form class="space-y-2" data-form="review" novalidate>
        <label class="label" for="nota">Sua avaliação</label>
        <select class="input max-w-xs" id="nota" required><option value="5">5 — Excelente</option><option value="4">4 — Bom</option><option value="3">3 — Regular</option><option value="2">2 — Ruim</option><option value="1">1 — Péssimo</option></select>
        <label class="sr-only" for="comentario">Comentário</label>
        <textarea class="input" id="comentario" rows="2" maxlength="2000" placeholder="Comentário público (opcional)"></textarea>
        <button class="btn-ghost" type="submit">Enviar avaliação</button>
      </form>`;
    actions = saldo + review;
  }

  const disputeBlock = openDispute ? `
    <section class="card space-y-3"><h2 class="font-semibold">Solicitação ${esc(openDispute.protocol)}</h2>
      <p class="text-sm">${esc(REASONS[openDispute.reason])} — ${esc(openDispute.description)}</p>
      <ul class="space-y-2 text-sm">${(openDispute.dispute_entries ?? []).map((e) => `<li class="rounded-lg bg-areia p-3"><span class="text-xs text-tinta-500">${e.author_id === uid ? 'Você' : 'Outra parte / equipe'} · ${fmtDateTime(e.created_at)}</span><br>${esc(e.body)}</li>`).join('')}</ul>
      <form class="space-y-2" data-form="dispute_entry" data-dispute="${esc(openDispute.id)}" novalidate>
        <label class="label" for="n-dispute_entry">Adicionar informação ou evidência</label>
        <textarea class="input" id="n-dispute_entry" rows="2" maxlength="5000" required></textarea>
        <button class="btn-ghost" type="submit">Enviar</button>
      </form></section>`
    : ['active', 'delivered', 'completed'].includes(c.status) ? `
    <details class="card"><summary class="cursor-pointer font-semibold">Algo saiu do combinado?</summary>
      <form class="mt-4 space-y-3" data-form="open_dispute" novalidate>
        <p class="text-sm text-tinta-700">A equipe analisa o caso com base no contrato, nas mensagens e nas evidências das duas partes. Não há multa nem retenção automática.</p>
        <div><label class="label" for="motivo">Motivo</label><select class="input" id="motivo">${Object.entries(REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div><label class="label" for="n-open_dispute">Descreva o que aconteceu</label><textarea class="input" id="n-open_dispute" rows="3" minlength="20" maxlength="5000" required></textarea></div>
        <button class="btn-ghost" type="submit">Abrir solicitação</button>
      </form></details>` : '';
  const closed = (disputes ?? []).filter((d) => d !== openDispute).map((d) => `<p class="text-sm text-tinta-500">Solicitação ${esc(d.protocol)} encerrada: ${esc(d.resolution ?? '')}</p>`).join('');

  root.innerHTML = `
    <header>
      <span class="chip-sol">${esc(STATUS[c.status] ?? c.status)}</span>${c.is_first_bico ? ' <span class="chip">Primeiro bico</span>' : ''}
      <h1 class="mt-2 text-2xl font-bold tracking-tight">${esc(c.projects?.title)}</h1>
    </header>
    <section class="card">
      <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div><dt class="text-xs text-tinta-500">Valor do contrato</dt><dd class="font-semibold">${brlExact(c.amount_cents)}</dd></div>
        <div><dt class="text-xs text-tinta-500">Taxa de serviço (plataforma)</dt><dd class="font-semibold">${brlExact(c.deposit_cents)}</dd></div>
        <div><dt class="text-xs text-tinta-500">Saldo (direto ao profissional)</dt><dd class="font-semibold">${brlExact(c.balance_cents)}</dd></div>
        <div><dt class="text-xs text-tinta-500">Prazo</dt><dd class="font-semibold">${c.deadline_days} dias</dd></div>
      </dl>
      <p class="mt-4 text-xs text-tinta-500">A taxa de serviço é paga pela empresa ao Bico BR. O saldo é pago pela empresa diretamente ao profissional: o Bico BR não recebe nem guarda esse valor. Termos: versão ${esc(c.terms_version)}.</p>
      <h2 class="mt-5 font-semibold">Escopo</h2><p class="mt-1 whitespace-pre-line text-sm text-tinta-700">${esc(c.scope)}</p>
      ${c.deliverables ? `<h2 class="mt-4 font-semibold">Entregáveis</h2><p class="mt-1 whitespace-pre-line text-sm text-tinta-700">${esc(c.deliverables)}</p>` : ''}
    </section>
    ${actions ? `<section class="card space-y-4" id="acoes"><h2 class="font-semibold">Próximo passo</h2>${actions}</section>` : ''}
    <section class="card"><div class="flex items-center justify-between"><h2 class="font-semibold">Histórico</h2><button class="linkish text-sm" type="button" data-action="chat">Abrir conversa</button></div>
      <ol class="mt-3 space-y-3 text-sm">${(events ?? []).map((e) => `<li class="border-l-2 border-mata-500 pl-3"><span class="text-xs text-tinta-500">${fmtDateTime(e.created_at)}</span><br><strong>${esc(EVENT[e.event] ?? e.event)}</strong>${e.note && !['dispute_opened', 'balance_declared_paid', 'balance_confirmed'].includes(e.event) ? `<br><span class="whitespace-pre-line text-tinta-700">${esc(e.note)}</span>` : ''}</li>`).join('')}</ol>
    </section>
    ${disputeBlock}${closed}`;

  const fail = (error) => { showNotice(aviso, 'error', rpcMessage(error)); aviso.scrollIntoView({ block: 'center' }); };
  const run = async (el, fn) => { el.disabled = true; try { const { error } = await fn(); if (error) { el.disabled = false; return fail(error); } location.reload(); } catch (err) { el.disabled = false; fail({ code: 'P0001', message: err.message }); } };

  root.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'pay') {
      el.disabled = true;
      try { goToCheckout((await api(`/payments/${deposit.id}/checkout`, { method: 'POST', body: {} })).checkoutUrl); }
      catch (err) { el.disabled = false; showNotice(aviso, 'error', err.message); }
      return;
    }
    if (a === 'chat') {
      const { data, error } = await sb.rpc('start_project_conversation', { p_project_id: c.project_id, p_freelancer_id: c.freelancer_id });
      if (error) return fail(error);
      location.href = `/mensagens?c=${data}`;
      return;
    }
    if (a === 'cancel_contract') {
      if (!confirm('Cancelar este contrato?')) return;
      return run(el, () => sb.rpc('cancel_contract', { p_contract_id: id, p_reason: isFreela ? 'Recusado pelo profissional' : 'Cancelado pela empresa' }));
    }
    if (a === 'approve_delivery' && !confirm('Aprovar a entrega e concluir o contrato?')) return;
    run(el, () => sb.rpc(a, { p_contract_id: id }));
  });

  root.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('[data-form]');
    if (!form) return;
    ev.preventDefault();
    const kind = form.dataset.form;
    const note = $(`#n-${kind}`, form)?.value.trim() ?? '';
    const min = Number($(`#n-${kind}`, form)?.minLength || 0);
    if (kind !== 'review' && note.length < Math.max(min, 1)) return showNotice(aviso, 'error', `Escreva pelo menos ${Math.max(min, 1)} caracteres.`);
    const submit = ev.submitter;
    if (kind === 'review') return run(submit, () => sb.from('reviews').insert({ contract_id: id, reviewer_id: uid, rating: Number($('#nota').value), comment: $('#comentario').value.trim() || null }));
    if (kind === 'open_dispute') return run(submit, () => sb.rpc('open_dispute', { p_contract_id: id, p_reason: $('#motivo').value, p_description: note }));
    if (kind === 'dispute_entry') return run(submit, () => sb.from('dispute_entries').insert({ dispute_id: form.dataset.dispute, author_id: uid, body: note }));
    return run(submit, () => sb.rpc(kind, { p_contract_id: id, p_note: note }));
  });
})();
