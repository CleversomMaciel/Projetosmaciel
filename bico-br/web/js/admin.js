import { $, brlExact, esc, fmtDateTime, getClient, mountChrome, parseBrlToCents, requireSession, rpcMessage, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');
const paineis = $('#paineis');
const mfaBox = $('#mfa');
const section = (id, title, body) => `<section class="card" id="${id}"><h2 class="font-semibold">${title}</h2><div class="mt-3 space-y-3 text-sm">${body}</div></section>`;
const METRIC_LABELS = {
  cadastros_empresas: 'Cadastros de empresas', cadastros_freelancers: 'Cadastros de profissionais', empresas_ativas: 'Empresas ativas',
  projetos_publicados: 'Projetos publicados', vagas_publicadas: 'Vagas publicadas', propostas_enviadas: 'Propostas enviadas',
  contratos_iniciados: 'Contratos iniciados', contratos_concluidos: 'Contratos concluídos', assinantes_ativos: 'Assinantes Pro ativos',
  disputas_abertas: 'Disputas abertas', disputas_no_periodo: 'Disputas no período', reembolsos_pendentes: 'Reembolsos pendentes',
  denuncias_abertas: 'Denúncias abertas', saldos_sem_confirmacao: 'Saldos sem confirmação há 7+ dias',
};
const MONEY = { gmv_centavos: 'GMV (valor contratado — não é receita)', ticket_medio_centavos: 'Ticket médio', receita_taxa_servico_centavos: 'Receita: taxa de serviço', receita_assinaturas_centavos: 'Receita: assinaturas', estornos_centavos: 'Estornos e contestações' };

/** Administração só abre com segundo fator verificado (aal2). */
async function ensureMfa(sb) {
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return true;
  const { data: factors } = await sb.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).find((f) => f.status === 'verified');
  mfaBox.hidden = false;
  let factorId = verified?.id;
  if (!verified) {
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Bico BR ${Date.now()}` });
    if (error) { showNotice(aviso, 'error', 'Não foi possível iniciar o cadastro do segundo fator.'); return false; }
    factorId = data.id;
    mfaBox.innerHTML = `<h2 class="font-semibold">Ative a verificação em duas etapas</h2>
      <p class="text-sm">A área administrativa exige um aplicativo autenticador. Leia o código com o aplicativo e digite os 6 dígitos.</p>
      <img alt="Código QR para o aplicativo autenticador" width="180" height="180" id="qr">
      <p class="break-all text-xs text-tinta-500">Chave manual: <code id="chave"></code></p>`;
    $('#qr').src = data.totp.qr_code; // data URI gerado pelo Supabase (CSP permite img data:)
    $('#chave').textContent = data.totp.secret;
  } else {
    mfaBox.innerHTML = '<h2 class="font-semibold">Verificação em duas etapas</h2><p class="text-sm">Digite o código do seu aplicativo autenticador.</p>';
  }
  mfaBox.insertAdjacentHTML('beforeend', `<form id="mfa-form" class="flex gap-2" novalidate>
    <label class="sr-only" for="codigo">Código de 6 dígitos</label>
    <input class="input" id="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>
    <button class="btn-primary" type="submit">Verificar</button></form>`);
  $('#mfa-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const code = $('#codigo').value.trim();
    if (!/^[0-9]{6}$/.test(code)) return showNotice(aviso, 'error', 'Digite os 6 dígitos.');
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return showNotice(aviso, 'error', 'Código incorreto ou expirado.');
    location.reload();
  });
  return false;
}

(async () => {
  const session = await requireSession();
  const { sb } = await getClient();
  const { data: me } = await sb.from('admin_members').select('role').eq('user_id', session.user.id).maybeSingle();
  if (!me) return showNotice(aviso, 'error', 'Acesso restrito.');
  if (!(await ensureMfa(sb))) return;
  const can = (...roles) => me.role === 'super_admin' || roles.includes(me.role);
  let html = '';

  if (can('finance')) {
    const { data: m } = await sb.rpc('admin_metrics', { p_days: 30 });
    if (m) {
      const tile = (label, value) => `<div class="rounded-xl bg-areia p-3"><dt class="text-xs text-tinta-500">${esc(label)}</dt><dd class="text-lg font-bold">${esc(value)}</dd></div>`;
      html += section('indicadores', 'Indicadores — últimos 30 dias', `<dl class="grid grid-cols-2 gap-3 md:grid-cols-4">
        ${Object.entries(MONEY).map(([k, l]) => tile(l, brlExact(m[k]))).join('')}
        ${tile('Conversão projeto → contrato', m.taxa_conversao_projeto_contrato == null ? '—' : `${(m.taxa_conversao_projeto_contrato * 100).toFixed(1)}%`)}
        ${Object.entries(METRIC_LABELS).map(([k, l]) => tile(l, m[k])).join('')}</dl>
        <p class="text-xs text-tinta-500">Receita é só o que a plataforma recebeu (taxa de serviço e assinaturas). CAC, LTV e margem dependem de dados de marketing e custos que ainda não são registrados aqui.</p>`);
    }
    const { data: plans } = await sb.from('plans').select('id, code, name, price_cents, proposals_per_cycle, is_active').order('sort_order');
    html += section('planos', 'Planos', (plans ?? []).map((p) => `<form class="flex flex-wrap items-end gap-2" data-plan="${esc(p.id)}" novalidate>
      <span class="w-40 font-medium">${esc(p.name)}<span class="block text-xs font-normal text-tinta-500">${p.proposals_per_cycle} propostas</span></span>
      <label class="sr-only" for="pr-${esc(p.code)}">Preço</label><input class="input w-32" id="pr-${esc(p.code)}" inputmode="decimal" value="${p.price_cents ? (p.price_cents / 100).toFixed(2).replace('.', ',') : ''}">
      <label class="flex items-center gap-2"><input class="accent-mata-600" type="checkbox" ${p.is_active ? 'checked' : ''}> Ativo</label>
      <button class="btn-ghost" type="submit">Salvar</button></form>`).join('') + '<p class="text-xs text-tinta-500">Alterações de preço valem para novas compras e ficam registradas na auditoria.</p>');
  }

  if (can('support')) {
    const { data: disputes } = await sb.from('disputes').select('id, protocol, reason, description, status, created_at, contract_id').not('status', 'in', '(resolved,closed)').order('created_at').limit(50);
    html += section('disputas', 'Disputas em aberto', (disputes ?? []).map((d) => `<form class="space-y-2 border-t border-tinta/10 pt-3" data-dispute="${esc(d.id)}" novalidate>
      <p><strong>${esc(d.protocol)}</strong> · ${esc(d.reason)} · ${fmtDateTime(d.created_at)}</p><p class="text-tinta-700">${esc(d.description)}</p>
      <label class="sr-only" for="res-${esc(d.id)}">Justificativa</label><textarea class="input" id="res-${esc(d.id)}" rows="2" minlength="20" maxlength="3000" placeholder="Justificativa da decisão (as partes verão este texto)" required></textarea>
      <div class="flex flex-wrap gap-2"><label class="sr-only" for="out-${esc(d.id)}">Desfecho</label><select class="input w-auto" id="out-${esc(d.id)}"><option value="resume">Retomar o contrato</option><option value="complete">Concluir o contrato</option><option value="cancel">Cancelar o contrato</option></select>
      <button class="btn-ghost" type="submit">Registrar decisão</button></div></form>`).join('') || '<p class="text-tinta-500">Nenhuma disputa em aberto.</p>');
  }

  if (can('moderation')) {
    const { data: reports } = await sb.from('reports').select('id, target_type, target_id, reason, details, created_at').in('status', ['open', 'in_review']).order('created_at').limit(50);
    html += section('denuncias', 'Denúncias', (reports ?? []).map((r) => `<div class="border-t border-tinta/10 pt-3"><p><strong>${esc(r.reason)}</strong> · ${esc(r.target_type)} ${esc(r.target_id)} · ${fmtDateTime(r.created_at)}</p>
      <p class="text-tinta-700">${esc(r.details)}</p><div class="mt-2 flex gap-2"><button class="btn-ghost" type="button" data-report="${esc(r.id)}" data-status="actioned">Medida tomada</button><button class="btn-ghost" type="button" data-report="${esc(r.id)}" data-status="dismissed">Improcedente</button></div></div>`).join('') || '<p class="text-tinta-500">Nenhuma denúncia em aberto.</p>');
  }

  if (can('finance', 'content')) {
    const PLACES = { home_banner: 'Destaque na página inicial', feed_inline: 'Card no feed', sidebar: 'Lateral das listagens' };
    const AD_STATUS = { draft: 'Rascunho', active: 'No ar', paused: 'Pausado', ended: 'Encerrado' };
    const [{ data: ads }, { data: requests }] = await Promise.all([
      sb.from('ad_campaigns').select('id, advertiser_name, title, placement, status, starts_at, ends_at, price_cents, impressions, clicks').order('created_at', { ascending: false }).limit(50),
      sb.from('ad_requests').select('id, company_name, contact, placement, message, created_at').eq('status', 'new').order('created_at').limit(50),
    ]);
    html += section('anuncios', 'Anúncios patrocinados', `
      ${(requests ?? []).length ? `<div class="notice-info"><p class="font-bold">Pedidos de anúncio aguardando contato</p><ul class="mt-2 space-y-2">${requests.map((r) => `<li><strong>${esc(r.company_name)}</strong> · ${esc(r.contact)} · ${esc(PLACES[r.placement] ?? 'formato a definir')}${r.message ? `<br><span class="text-tinta-700">${esc(r.message)}</span>` : ''} <button class="linkish text-xs" type="button" data-adreq="${esc(r.id)}">Marcar como contatado</button></li>`).join('')}</ul></div>` : ''}
      <ul class="space-y-2">${(ads ?? []).map((a) => `<li class="flex flex-wrap items-center justify-between gap-3 border-t border-tinta/10 pt-2">
        <span><strong>${esc(a.title)}</strong> — ${esc(a.advertiser_name)}<span class="block text-xs text-tinta-500">${esc(PLACES[a.placement])} · até ${fmtDateTime(a.ends_at)} · ${a.price_cents != null ? brlExact(a.price_cents) : 'sem valor'} · ${a.impressions} exibições · ${a.clicks} cliques</span></span>
        <span class="flex items-center gap-2"><span class="chip-neutral">${esc(AD_STATUS[a.status])}</span>
          ${a.status === 'ended' ? '' : `<button class="linkish text-xs" type="button" data-ad-id="${esc(a.id)}" data-ad-status="${a.status === 'active' ? 'paused' : 'active'}">${a.status === 'active' ? 'Pausar' : 'Colocar no ar'}</button>`}</span></li>`).join('') || '<li class="text-tinta-500">Nenhuma campanha cadastrada.</li>'}</ul>
      <form id="novo-anuncio" class="grid gap-3 border-t border-tinta/10 pt-4 sm:grid-cols-2" novalidate>
        <p class="font-bold sm:col-span-2">Nova campanha</p>
        <div><label class="label" for="ad-anunciante">Anunciante</label><input class="input" id="ad-anunciante" maxlength="60" required></div>
        <div><label class="label" for="ad-local">Espaço</label><select class="input" id="ad-local">${Object.entries(PLACES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="sm:col-span-2"><label class="label" for="ad-titulo">Título (até 70 caracteres)</label><input class="input" id="ad-titulo" maxlength="70" required></div>
        <div class="sm:col-span-2"><label class="label" for="ad-texto">Texto (até 160 caracteres)</label><input class="input" id="ad-texto" maxlength="160"></div>
        <div><label class="label" for="ad-url">Link de destino (https)</label><input class="input" id="ad-url" type="url" placeholder="https://" required></div>
        <div><label class="label" for="ad-cta">Texto do botão</label><input class="input" id="ad-cta" maxlength="24" value="Saiba mais"></div>
        <div><label class="label" for="ad-dias">Duração (dias)</label><input class="input" id="ad-dias" type="number" min="1" max="365" value="30"></div>
        <div><label class="label" for="ad-preco">Valor cobrado (R$)</label><input class="input" id="ad-preco" inputmode="decimal"></div>
        <div class="sm:col-span-2"><button class="btn-ghost" type="submit">Salvar como rascunho</button><span class="ml-3 text-xs text-tinta-500">A campanha só aparece depois de “Colocar no ar”.</span></div>
      </form>`);
  }

  if (can('content')) {
    const { data: cats } = await sb.from('categories').select('id, name, slug, is_active').order('sort_order');
    html += section('categorias', 'Categorias', `<ul class="space-y-1">${(cats ?? []).map((c) => `<li class="flex items-center justify-between gap-3"><span>${esc(c.name)} <span class="text-xs text-tinta-500">/${esc(c.slug)}</span></span>
      <button class="linkish text-xs" type="button" data-cat="${esc(c.id)}" data-active="${c.is_active ? '0' : '1'}">${c.is_active ? 'Desativar' : 'Ativar'}</button></li>`).join('')}</ul>
      <form id="nova-cat" class="flex flex-wrap items-end gap-2 border-t border-tinta/10 pt-3" novalidate>
        <div><label class="label" for="cn">Nova categoria</label><input class="input" id="cn" maxlength="80" required></div>
        <div><label class="label" for="cs">Slug</label><input class="input lowercase" id="cs" maxlength="80" pattern="[a-z0-9-]+" required></div>
        <button class="btn-ghost" type="submit">Adicionar</button></form>`);
  }
  paineis.innerHTML = html || '<p class="text-sm text-tinta-500">Sua função não tem painéis disponíveis.</p>';

  const done = (error) => (error ? showNotice(aviso, 'error', rpcMessage(error)) : location.reload());
  paineis.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (f.dataset.plan) {
      const price = parseBrlToCents($('input[inputmode]', f).value);
      const active = $('input[type=checkbox]', f).checked;
      if (active && !price) return showNotice(aviso, 'error', 'Plano ativo precisa de preço.');
      return done((await sb.from('plans').update({ price_cents: price, is_active: active }).eq('id', f.dataset.plan)).error);
    }
    if (f.dataset.dispute) {
      const text = $('textarea', f).value.trim();
      if (text.length < 20) return showNotice(aviso, 'error', 'A justificativa precisa de pelo menos 20 caracteres.');
      if (!confirm('Registrar esta decisão? Ela é definitiva e fica na auditoria.')) return;
      return done((await sb.rpc('resolve_dispute', { p_dispute_id: f.dataset.dispute, p_resolution: text, p_outcome: $('select', f).value })).error);
    }
    if (f.id === 'novo-anuncio') {
      const url = $('#ad-url').value.trim();
      const days = Number.parseInt($('#ad-dias').value, 10) || 30;
      if (!/^https:\/\//i.test(url)) return showNotice(aviso, 'error', 'O link de destino precisa começar com https://');
      if ($('#ad-titulo').value.trim().length < 4 || $('#ad-anunciante').value.trim().length < 2) return showNotice(aviso, 'error', 'Informe anunciante e título.');
      return done((await sb.from('ad_campaigns').insert({
        advertiser_name: $('#ad-anunciante').value.trim(), title: $('#ad-titulo').value.trim(), body: $('#ad-texto').value.trim() || null,
        target_url: url, cta_label: $('#ad-cta').value.trim() || 'Saiba mais', placement: $('#ad-local').value,
        ends_at: new Date(Date.now() + days * 86400000).toISOString(), price_cents: parseBrlToCents($('#ad-preco').value),
        status: 'draft', created_by: session.user.id,
      })).error);
    }
    if (f.id === 'nova-cat') {
      const slug = $('#cs').value.trim().toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || $('#cn').value.trim().length < 2) return showNotice(aviso, 'error', 'Informe nome e slug (letras minúsculas, números e hífen).');
      return done((await sb.from('categories').insert({ name: $('#cn').value.trim(), slug, sort_order: 999 })).error);
    }
    return undefined;
  });
  paineis.addEventListener('click', async (ev) => {
    const cat = ev.target.closest('[data-cat]');
    if (cat) return done((await sb.from('categories').update({ is_active: cat.dataset.active === '1' }).eq('id', cat.dataset.cat)).error);
    const ad = ev.target.closest('[data-ad-id]');
    if (ad) return done((await sb.from('ad_campaigns').update({ status: ad.dataset.adStatus }).eq('id', ad.dataset.adId)).error);
    const req = ev.target.closest('[data-adreq]');
    if (req) return done((await sb.from('ad_requests').update({ status: 'contacted' }).eq('id', req.dataset.adreq)).error);
    const rep = ev.target.closest('[data-report]');
    if (rep) return done((await sb.from('reports').update({ status: rep.dataset.status, handled_by: session.user.id, handled_at: new Date().toISOString() }).eq('id', rep.dataset.report)).error);
    return undefined;
  });
})();
