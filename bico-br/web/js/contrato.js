import { $, $$, api, brlExact, esc, fmtDate, fmtDateTime, getClient, goToCheckout, icon, mountChrome, requireSession, rpcMessage, showNotice } from './core.js';

mountChrome();
const id = new URLSearchParams(location.search).get('id') ?? '';
const aviso = $('#aviso');
const root = $('#contrato');
const STATUS = {
  awaiting_freelancer: 'Aguardando confirmação do profissional', awaiting_deposit: 'Aguardando pagamento da empresa',
  active: 'Em execução', delivered: 'Entregue — aguardando validação', completed: 'Concluído', cancelled: 'Cancelado',
  disputed: 'Em análise na Central de Confiança',
};
const EVENT = {
  proposal_accepted: 'Proposta aceita pela empresa', freelancer_confirmed: 'Contrato confirmado pelo profissional',
  contract_started: 'Pagamento confirmado pelo Mercado Pago — execução iniciada', delivered: 'Entrega registrada na plataforma',
  changes_requested: 'Ajustes solicitados', approved: 'Entrega validada pela empresa — projeto concluído',
  auto_approved: 'Entrega validada automaticamente (prazo de análise esgotado) — projeto concluído',
  completed_by_dispute: 'Contrato concluído por decisão da Central de Confiança', cancelled: 'Contrato cancelado',
  dispute_opened: 'Reclamação aberta na Central de Confiança', dispute_resolved: 'Reclamação encerrada',
  payment_refunded: 'Pagamento estornado', payment_charged_back: 'Pagamento contestado', payment_in_mediation: 'Pagamento em mediação',
  payment_needs_refund: 'Pagamento recebido fora do fluxo — devolução em análise',
};
const PAYOUT = {
  held: ['Crédito retido', 'O valor do profissional já foi pago pela empresa e fica retido até a entrega ser validada.'],
  blocked: ['Crédito em análise', 'Há uma reclamação aberta. O valor fica congelado até a decisão da Central de Confiança.'],
  released: ['Crédito liberado', 'A entrega foi validada. O repasse ao profissional está em andamento.'],
  paid: ['Pagamento ao profissional', 'O Mercado Pago destinou este valor à conta Mercado Pago do profissional. A tarifa do Mercado Pago é descontada por ele. O Bico BR não guarda valores.'],
  refunded: ['Valor devolvido', 'O valor foi destinado à devolução para a empresa.'],
};
const ITEM = { pending: 'A entregar', delivered: 'Entregue', accepted: 'Validado', changes: 'Ajuste pedido' };
const REASONS = { nao_entrega: 'O projeto não foi entregue', entrega_fora_do_escopo: 'Entrega diferente do combinado', atraso: 'Atraso', nao_pagamento: 'Problema com o pagamento', comunicacao: 'Falta de resposta', outro: 'Outro motivo' };
const safeLink = (url) => (/^https:\/\//i.test(url ?? '') ? `<a class="linkish break-all" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(url)}</a>` : '');

(async () => {
  const session = await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(id)) { root.innerHTML = '<p>Contrato não encontrado.</p>'; return; }
  const { sb } = await getClient();
  const uid = session.user.id;

  const [{ data: c }, { data: events }, { data: payments }, { data: reviews }, { data: disputes }, { data: items }, { data: payout }] = await Promise.all([
    sb.from('contracts').select('id, status, project_id, freelancer_id, company_user_id, scope, amount_cents, deposit_cents, deadline_days, due_at, is_first_bico, terms_version, projects(id, title)').eq('id', id).maybeSingle(),
    sb.from('contract_events').select('event, note, created_at').eq('contract_id', id).order('created_at'),
    sb.from('payments').select('id, kind, status, amount_cents').eq('contract_id', id),
    sb.from('reviews').select('reviewer_id, rating, comment').eq('contract_id', id),
    sb.from('disputes').select('id, protocol, status, reason, description, resolution, created_at, dispute_entries(body, author_id, created_at)').eq('contract_id', id).order('created_at', { ascending: false }),
    sb.from('contract_deliverables').select('id, position, title, status, delivery_note, delivery_url, review_note').eq('contract_id', id).order('position'),
    sb.from('payouts').select('status, amount_cents, paid_at').eq('contract_id', id).maybeSingle(),
  ]);
  if (!c) { root.innerHTML = '<p>Contrato não encontrado.</p>'; return; }

  const isCompany = c.company_user_id === uid;
  const isFreela = c.freelancer_id === uid;
  const charge = (payments ?? []).find((p) => p.kind === 'deposit');
  const myReview = (reviews ?? []).find((r) => r.reviewer_id === uid);
  const openDispute = (disputes ?? []).find((d) => !['resolved', 'closed'].includes(d.status));
  const total = c.amount_cents + c.deposit_cents;
  document.title = `Contrato: ${c.projects?.title ?? ''} — Bico BR`;

  const btn = (label, action, style = 'btn-primary') => `<button class="${style}" type="button" data-action="${action}">${label}</button>`;
  const badge = (st) => `<span class="${st === 'accepted' ? 'chip' : st === 'changes' ? 'chip-sol' : 'chip-neutral'}">${ITEM[st]}</span>`;

  // ---------------------------------------------------------------- itens da entrega
  const editable = isFreela && c.status === 'active';
  const reviewable = isCompany && c.status === 'delivered';
  const itemsHtml = (items ?? []).map((it) => {
    const todo = editable && ['pending', 'changes'].includes(it.status);
    return `<li class="rounded-2xl bg-white p-4 ring-1 ring-tinta/[.06]" data-item="${it.id}">
      <div class="flex flex-wrap items-center justify-between gap-2"><p class="font-semibold">${it.position}. ${esc(it.title)}</p>${badge(it.status)}</div>
      ${it.review_note && it.status === 'changes' ? `<p class="notice-warn mt-2">Ajuste pedido: ${esc(it.review_note)}</p>` : ''}
      ${todo ? `<div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2"><label class="label" for="in-${it.id}">O que foi feito neste item</label><textarea class="input" id="in-${it.id}" data-note rows="2" maxlength="3000" required>${esc(it.delivery_note ?? '')}</textarea></div>
          <div class="sm:col-span-2"><label class="label" for="iu-${it.id}">Link do arquivo ou do resultado <span class="font-normal text-tinta-500">(https, opcional)</span></label><input class="input" id="iu-${it.id}" data-url type="url" placeholder="https://" value="${esc(it.delivery_url ?? '')}"></div></div>`
    : `${it.delivery_note ? `<p class="mt-2 whitespace-pre-line text-sm text-tinta-700">${esc(it.delivery_note)}</p>` : ''}${it.delivery_url ? `<p class="mt-1 text-sm">${safeLink(it.delivery_url)}</p>` : ''}`}
      ${reviewable && it.status === 'delivered' ? `<label class="mt-3 flex items-center gap-2 text-sm"><input class="h-4 w-4 accent-mata-600" type="checkbox" data-change="${it.id}"> Este item precisa de ajuste</label>` : ''}
    </li>`;
  }).join('');

  // ---------------------------------------------------------------- próximo passo
  let actions = '';
  if (c.status === 'awaiting_freelancer') {
    actions = isFreela
      ? `<p class="text-sm">Confira escopo, valor, prazo e os itens a entregar. Para receber, sua conta do Mercado Pago precisa estar conectada em <a class="linkish" href="/perfil">Meu perfil</a>. Ao confirmar, a empresa é avisada para pagar e o trabalho começa quando o pagamento for confirmado.</p><div class="flex flex-wrap gap-2">${btn('Confirmar contrato', 'confirm_contract')}${btn('Recusar', 'cancel_contract', 'btn-ghost')}</div>`
      : `<p class="text-sm text-tinta-500">Aguardando o profissional confirmar o contrato.</p>${btn('Cancelar contrato', 'cancel_contract', 'btn-ghost')}`;
  } else if (c.status === 'awaiting_deposit') {
    actions = isCompany
      ? `<p class="text-sm">Pague <strong>${brlExact(total)}</strong> para iniciar, com cartão ou Pix, na página do Mercado Pago: ${brlExact(c.amount_cents)} vão direto para a conta do profissional e ${brlExact(c.deposit_cents)} são a taxa de serviço do Bico BR.</p><div class="flex flex-wrap gap-2">${charge?.status === 'pending' ? btn('Pagar e iniciar o projeto', 'pay') : '<span class="chip">Pagamento em processamento</span>'}${btn('Cancelar contrato', 'cancel_contract', 'btn-ghost')}</div>`
      : '<p class="text-sm text-tinta-500">Aguardando o pagamento da empresa. Não comece o trabalho antes da confirmação.</p>';
  } else if (c.status === 'active') {
    actions = isFreela
      ? `<p class="text-sm">Registre a entrega de <strong>todos os itens</strong> aqui na plataforma. É este registro que comprova o trabalho e vale em caso de reclamação.</p>
         <form class="space-y-3" data-form="deliver_contract" novalidate>
           <div><label class="label" for="n-deliver_contract">Resumo da entrega</label><textarea class="input" id="n-deliver_contract" rows="3" minlength="10" maxlength="3000" placeholder="Explique o que foi entregue e como a empresa confere." required></textarea></div>
           <button class="btn-primary" type="submit">Enviar entrega para validação</button></form>`
      : `<p class="text-sm text-tinta-500">Em execução. Prazo combinado: ${fmtDate(c.due_at)}.</p>`;
  } else if (c.status === 'delivered') {
    actions = isCompany
      ? `<p class="text-sm">Confira cada item acima. Validar conclui o projeto. Sem resposta em 7 dias, a entrega é validada automaticamente.</p>
         <div class="flex flex-wrap gap-2">${btn('Validar entrega e concluir', 'approve_delivery')}</div>
         <form class="space-y-2" data-form="request_changes" novalidate>
           <label class="label" for="n-request_changes">Pedir ajustes <span class="font-normal text-tinta-500">(marque acima os itens que precisam de ajuste)</span></label>
           <textarea class="input" id="n-request_changes" rows="3" minlength="10" maxlength="2000" placeholder="O que precisa ser ajustado?" required></textarea>
           <button class="btn-ghost" type="submit">Pedir ajustes</button></form>`
      : '<p class="text-sm text-tinta-500">Entrega enviada. A empresa tem 7 dias para validar; depois disso a validação é automática.</p>';
  } else if (c.status === 'completed') {
    actions = myReview ? `<p class="text-sm text-tinta-500">Você avaliou com nota ${myReview.rating}.</p>` : `
      <form class="space-y-2" data-form="review" novalidate>
        <label class="label" for="nota">Sua avaliação</label>
        <select class="input max-w-xs" id="nota" required><option value="5">5 — Excelente</option><option value="4">4 — Bom</option><option value="3">3 — Regular</option><option value="2">2 — Ruim</option><option value="1">1 — Péssimo</option></select>
        <label class="sr-only" for="comentario">Comentário</label>
        <textarea class="input" id="comentario" rows="2" maxlength="2000" placeholder="Comentário público (opcional)"></textarea>
        <button class="btn-ghost" type="submit">Enviar avaliação</button>
      </form>`;
  }

  const [poTitle, poText] = PAYOUT[payout?.status] ?? [];
  const payoutBox = payout ? `<div class="${payout.status === 'blocked' ? 'notice-warn' : 'notice-info'} flex items-start gap-3">${icon(payout.status === 'paid' || payout.status === 'released' ? 'check' : 'shield')}
      <p><strong>${poTitle}: ${brlExact(payout.amount_cents)}</strong><br>${poText}</p></div>` : '';

  const disputeBlock = openDispute ? `
    <section class="card space-y-3"><h2 class="font-semibold">Reclamação ${esc(openDispute.protocol)}</h2>
      <p class="text-sm">${esc(REASONS[openDispute.reason])} — ${esc(openDispute.description)}</p>
      <ul class="space-y-2 text-sm">${(openDispute.dispute_entries ?? []).map((e) => `<li class="rounded-2xl bg-areia p-3"><span class="text-xs text-tinta-500">${e.author_id === uid ? 'Você' : 'Outra parte / equipe'} · ${fmtDateTime(e.created_at)}</span><br>${esc(e.body)}</li>`).join('')}</ul>
      <form class="space-y-2" data-form="dispute_entry" data-dispute="${esc(openDispute.id)}" novalidate>
        <label class="label" for="n-dispute_entry">Adicionar informação ou evidência</label>
        <textarea class="input" id="n-dispute_entry" rows="2" maxlength="5000" required></textarea>
        <button class="btn-ghost" type="submit">Enviar</button>
      </form></section>`
    : ['active', 'delivered', 'completed'].includes(c.status) ? `
    <details class="card" id="reclamar"><summary class="cursor-pointer font-semibold">Algo saiu do combinado? Abrir reclamação</summary>
      <form class="mt-4 space-y-3" data-form="open_dispute" novalidate>
        <p class="text-sm text-tinta-700">A equipe analisa o caso com base no contrato, nos itens entregues, nas mensagens e nas evidências das duas partes. Se a decisão for pela devolução, ela é feita pelo Mercado Pago. Você pode reclamar até 30 dias depois da conclusão.</p>
        <div><label class="label" for="motivo">Motivo</label><select class="input" id="motivo">${Object.entries(REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div><label class="label" for="n-open_dispute">Descreva o que aconteceu</label><textarea class="input" id="n-open_dispute" rows="3" minlength="20" maxlength="5000" required></textarea></div>
        <button class="btn-ghost" type="submit">Abrir reclamação</button>
      </form></details>` : '';
  const closed = (disputes ?? []).filter((d) => d !== openDispute).map((d) => `<p class="text-sm text-tinta-500">Reclamação ${esc(d.protocol)} encerrada: ${esc(d.resolution ?? '')}</p>`).join('');

  root.innerHTML = `
    <header>
      <span class="chip-sol">${esc(STATUS[c.status] ?? c.status)}</span>${c.is_first_bico ? ' <span class="chip">Primeiro bico</span>' : ''}
      <h1 class="mt-2 text-2xl font-bold tracking-tight">${esc(c.projects?.title)}</h1>
    </header>
    <section class="card">
      <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div><dt class="text-xs text-tinta-500">Valor do profissional</dt><dd class="font-semibold">${brlExact(c.amount_cents)}</dd></div>
        <div><dt class="text-xs text-tinta-500">Taxa de serviço (10%)</dt><dd class="font-semibold">${brlExact(c.deposit_cents)}</dd></div>
        <div><dt class="text-xs text-tinta-500">Total pago pela empresa</dt><dd class="font-semibold">${brlExact(total)}</dd></div>
        <div><dt class="text-xs text-tinta-500">Prazo</dt><dd class="font-semibold">${c.deadline_days} dias</dd></div>
      </dl>
      <p class="mt-4 text-xs text-tinta-500">A taxa de serviço é paga pela empresa. O valor do profissional vai direto para a conta Mercado Pago dele; o Bico BR não desconta comissão. Termos: versão ${esc(c.terms_version)}.</p>
      <h2 class="mt-5 font-semibold">Escopo</h2><p class="mt-1 whitespace-pre-line text-sm text-tinta-700">${esc(c.scope)}</p>
    </section>
    ${payoutBox}
    <section class="card"><h2 class="font-semibold">Itens da entrega</h2>
      <p class="mt-1 text-xs text-tinta-500">A entrega acontece aqui dentro: cada item é entregue pelo profissional e conferido pela empresa. É esse registro que conclui o projeto e que vale em caso de reclamação.</p>
      <ul class="mt-4 space-y-3" id="itens">${itemsHtml}</ul></section>
    ${actions ? `<section class="card space-y-4" id="acoes"><h2 class="font-semibold">Próximo passo</h2>${actions}</section>` : ''}
    <section class="card"><div class="flex items-center justify-between"><h2 class="font-semibold">Histórico</h2><button class="linkish text-sm" type="button" data-action="chat">Abrir conversa</button></div>
      <ol class="mt-3 space-y-3 text-sm">${(events ?? []).map((e) => `<li class="border-l-2 border-mata-500 pl-3"><span class="text-xs text-tinta-500">${fmtDateTime(e.created_at)}</span><br><strong>${esc(EVENT[e.event] ?? e.event)}</strong>${e.note && ['delivered', 'changes_requested', 'cancelled', 'dispute_resolved'].includes(e.event) ? `<br><span class="whitespace-pre-line text-tinta-700">${esc(e.note)}</span>` : ''}</li>`).join('')}</ol>
    </section>
    ${disputeBlock}${closed}`;
  if (location.hash === '#reclamar') { const d = $('#reclamar'); if (d) { d.open = true; d.scrollIntoView(); } }

  const fail = (error) => { showNotice(aviso, 'error', rpcMessage(error)); aviso.scrollIntoView({ block: 'center' }); };
  const run = async (el, fn) => { el.disabled = true; try { const { error } = await fn(); if (error) { el.disabled = false; return fail(error); } location.reload(); } catch (err) { el.disabled = false; fail({ code: 'P0001', message: err.message }); } };

  root.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'pay') {
      el.disabled = true;
      try { goToCheckout((await api(`/payments/${charge.id}/checkout`, { method: 'POST', body: {} })).checkoutUrl); }
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
    if (a === 'approve_delivery' && !confirm('Validar a entrega? Esta ação conclui o contrato.')) return;
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
    if (kind === 'deliver_contract') {
      const payload = [];
      for (const li of $$('#itens [data-item]')) {
        const n = $('[data-note]', li); if (!n) continue;
        const url = $('[data-url]', li).value.trim();
        if (n.value.trim().length < 5) { n.focus(); return showNotice(aviso, 'error', 'Descreva o que foi feito em cada item da entrega.'); }
        if (url && !/^https:\/\//i.test(url)) return showNotice(aviso, 'error', 'Os links precisam começar com https://');
        payload.push({ id: Number(li.dataset.item), note: n.value.trim(), url: url || null });
      }
      return run(submit, () => sb.rpc('deliver_contract', { p_contract_id: id, p_note: note, p_items: payload }));
    }
    if (kind === 'request_changes') {
      const ids = $$('[data-change]:checked').map((x) => Number(x.dataset.change));
      return run(submit, () => sb.rpc('request_changes', { p_contract_id: id, p_note: note, p_item_ids: ids.length ? ids : null }));
    }
    return undefined;
  });
})();
