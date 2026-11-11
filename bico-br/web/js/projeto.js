import { $, brl, budgetLabel, esc, getClient, getProfile, mountChrome, parseBrlToCents, rpcMessage, setBusy, showNotice, timeAgo, warnIfUnconfigured } from './core.js';

mountChrome();
const id = new URLSearchParams(location.search).get('id') ?? '';
const detail = $('#detalhe');
const side = $('#lateral');
const PROPOSAL_ERRORS = {
  PRO_REQUIRED: 'Você já concluiu seu primeiro bico. Para enviar novas propostas é preciso ativar um plano Bico BR Pro no painel.',
  QUOTA_EXCEEDED: 'Você usou todas as propostas do ciclo atual do seu plano.',
  ABUSE_LIMIT: 'Limite diário de segurança atingido. Tente novamente amanhã.',
};

(async () => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) { detail.innerHTML = '<p>Projeto não encontrado.</p>'; return; }
  if (!(await warnIfUnconfigured(detail))) return;
  const { sb } = await getClient();
  const { data: p } = await sb.from('projects')
    .select('id, kind, status, title, description, deliverables, budget_type, budget_min_cents, budget_max_cents, deadline_days, experience_level, professionals_wanted, published_at, proposals_count, company_id, categories(name, slug), subcategories(name), companies(display_name, slug, city, uf, description, rating_avg, rating_count, registry_status, registry_checked_at, cnpj_masked, owner_id)')
    .eq('id', id).maybeSingle();
  if (!p) { detail.innerHTML = '<p>Projeto não encontrado ou não está mais disponível.</p>'; return; }

  document.title = `${p.title} — Bico BR`;
  detail.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      ${p.kind === 'quick' ? '<span class="chip-sol">Bico Rápido</span>' : ''}
      <a class="chip" href="/projetos?categoria=${encodeURIComponent(p.categories?.slug ?? '')}">${esc(p.categories?.name)}</a>
      ${p.subcategories ? `<span class="chip">${esc(p.subcategories.name)}</span>` : ''}
      <span class="text-xs text-tinta-500">Publicado ${esc(timeAgo(p.published_at))}</span>
    </div>
    <h1 class="mt-3 text-2xl font-bold tracking-tight">${esc(p.title)}</h1>
    <dl class="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-areia p-4 text-sm sm:grid-cols-4">
      <div><dt class="text-xs text-tinta-500">Orçamento</dt><dd class="font-semibold">${esc(budgetLabel(p))}</dd></div>
      <div><dt class="text-xs text-tinta-500">Prazo</dt><dd class="font-semibold">${p.deadline_days ? `${p.deadline_days} dias` : 'A combinar'}</dd></div>
      <div><dt class="text-xs text-tinta-500">Propostas</dt><dd class="font-semibold">${p.proposals_count}</dd></div>
      <div><dt class="text-xs text-tinta-500">Profissionais</dt><dd class="font-semibold">${p.professionals_wanted}</dd></div>
    </dl>
    <h2 class="mt-6 font-semibold">Descrição</h2>
    <p class="mt-2 whitespace-pre-line text-sm text-tinta-700">${esc(p.description)}</p>
    ${p.deliverables ? `<h2 class="mt-6 font-semibold">Entregáveis</h2><p class="mt-2 whitespace-pre-line text-sm text-tinta-700">${esc(p.deliverables)}</p>` : ''}`;

  const c = p.companies;
  const companyCard = `
    <div class="card text-sm">
      <h2 class="font-semibold">${esc(c.display_name)}</h2>
      <p class="text-tinta-500">${esc([c.city, c.uf].filter(Boolean).join(' · '))}</p>
      ${c.rating_count ? `<p class="mt-2">Avaliação ${Number(c.rating_avg).toFixed(1)} (${c.rating_count})</p>` : '<p class="mt-2 text-tinta-500">Ainda sem avaliações</p>'}
      ${c.cnpj_masked ? `<p class="mt-2 text-xs text-tinta-500">CNPJ ${esc(c.cnpj_masked)}${c.registry_status ? ` · situação cadastral ${esc(c.registry_status.toLowerCase())} em ${new Date(c.registry_checked_at).toLocaleDateString('pt-BR')}` : ' · dados não consultados'}.<br>A situação cadastral não atesta idoneidade.</p>` : ''}
    </div>`;

  const profile = await getProfile();
  if (!profile) {
    side.innerHTML = `<div class="card"><p class="text-sm">Entre para enviar sua proposta.</p><a class="btn-primary mt-3 w-full" href="/entrar?next=${encodeURIComponent(location.pathname + location.search)}">Entrar</a></div>${companyCard}`;
    return;
  }

  // ---------------------------------------------- dona do projeto: propostas recebidas
  if (c.owner_id === profile.id) {
    const { data: proposals } = await sb.from('proposals')
      .select('id, freelancer_id, amount_cents, deadline_days, cover_letter, status, created_at, freelancer_profiles(headline, slug, profiles(display_name))')
      .eq('project_id', p.id).order('created_at', { ascending: false }).limit(50);
    side.innerHTML = `<div class="card"><h2 class="font-semibold">Propostas recebidas</h2><p id="p-aviso" class="mt-3" hidden></p>
      <ul class="mt-3 space-y-4 text-sm">${(proposals ?? []).map((x) => `
        <li class="border-t border-tinta/10 pt-3">
          <p class="font-medium">${esc(x.freelancer_profiles?.profiles?.display_name || 'Profissional')}</p>
          <p class="text-xs text-tinta-500">${esc(x.freelancer_profiles?.headline)}</p>
          <p class="mt-1 font-medium">${brl(x.amount_cents)} · ${x.deadline_days} dias <span class="chip ml-1">${esc(x.status)}</span></p>
          <p class="mt-1 whitespace-pre-line text-tinta-700">${esc(x.cover_letter)}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            ${['sent', 'shortlisted'].includes(x.status) && p.status === 'open' ? `<button class="btn-primary" type="button" data-accept="${esc(x.id)}">Aceitar proposta</button>` : ''}
            <button class="btn-ghost" type="button" data-chat="${esc(x.freelancer_id)}">Conversar</button>
          </div>
        </li>`).join('') || '<li class="text-tinta-500">Nenhuma proposta ainda.</li>'}</ul></div>`;
    side.addEventListener('click', async (ev) => {
      const chat = ev.target.closest('[data-chat]');
      if (chat) {
        const { data, error } = await sb.rpc('start_project_conversation', { p_project_id: p.id, p_freelancer_id: chat.dataset.chat });
        if (error) return showNotice($('#p-aviso'), 'error', 'Não foi possível abrir a conversa.');
        location.href = `/mensagens?c=${data}`;
        return;
      }
      const btn = ev.target.closest('[data-accept]');
      if (!btn || !confirm('Aceitar esta proposta e gerar o contrato para confirmação do profissional?')) return;
      setBusy(btn, true);
      const { data, error } = await sb.rpc('accept_proposal', { p_proposal_id: btn.dataset.accept });
      if (error) { setBusy(btn, false); return showNotice($('#p-aviso'), 'error', rpcMessage(error)); }
      location.href = `/contrato?id=${data.id}`;
    });
    return;
  }

  if (profile.account_type !== 'freelancer') { side.innerHTML = companyCard; return; }

  // ---------------------------------------------- freelancer: enviar proposta
  const { data: mine } = await sb.from('proposals').select('amount_cents, deadline_days, status').eq('project_id', p.id).eq('freelancer_id', profile.id).maybeSingle();
  if (mine) {
    side.innerHTML = `<div class="card text-sm"><h2 class="font-semibold">Sua proposta</h2><p class="mt-2">${brl(mine.amount_cents)} · ${mine.deadline_days} dias</p><p class="chip mt-2">${esc(mine.status)}</p>
      <p class="mt-3"><button class="btn-ghost" type="button" id="falar">Conversar com a empresa</button></p></div>${companyCard}`;
    $('#falar').addEventListener('click', async () => {
      const { data, error } = await sb.rpc('start_project_conversation', { p_project_id: p.id, p_freelancer_id: profile.id });
      if (!error) location.href = `/mensagens?c=${data}`;
    });
    return;
  }
  if (p.status !== 'open') { side.innerHTML = `<div class="card text-sm">Este projeto não está mais recebendo propostas.</div>${companyCard}`; return; }
  const fixed = p.kind === 'quick';
  side.innerHTML = `
    <form id="proposta" class="card space-y-3" novalidate>
      <h2 class="font-semibold">Enviar proposta</h2>
      <p id="p-aviso" hidden></p>
      <div><label class="label" for="valor">Seu valor (R$)</label><input class="input" id="valor" inputmode="decimal" required value="${fixed ? (p.budget_min_cents / 100).toLocaleString('pt-BR') : ''}"></div>
      <div><label class="label" for="prazo">Prazo de entrega (dias)</label><input class="input" id="prazo" type="number" min="1" max="730" required value="${p.deadline_days ?? ''}"></div>
      <div><label class="label" for="carta">Apresentação</label><textarea class="input" id="carta" rows="5" minlength="20" maxlength="5000" required placeholder="Como você resolveria este projeto?"></textarea></div>
      <div><label class="label" for="exp">Experiência relevante <span class="font-normal text-tinta-500">(opcional)</span></label><textarea class="input" id="exp" rows="2" maxlength="3000"></textarea></div>
      <button class="btn-primary w-full" type="submit">Enviar proposta</button>
    </form>${companyCard}`;
  $('#proposta').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const aviso = $('#p-aviso');
    const amount = parseBrlToCents($('#valor').value);
    const days = Number.parseInt($('#prazo').value, 10);
    const letter = $('#carta').value.trim();
    if (!amount) return showNotice(aviso, 'error', 'Informe o valor da proposta.');
    if (!(days >= 1)) return showNotice(aviso, 'error', 'Informe o prazo em dias.');
    if (letter.length < 20) return showNotice(aviso, 'error', 'Escreva uma apresentação com pelo menos 20 caracteres.');
    setBusy(ev.submitter, true, 'Enviando…');
    const { error } = await sb.rpc('submit_proposal', {
      p_project_id: p.id, p_amount_cents: amount, p_deadline_days: days, p_cover_letter: letter,
      p_relevant_experience: $('#exp').value.trim() || null,
    });
    if (error) {
      setBusy(ev.submitter, false);
      return showNotice(aviso, PROPOSAL_ERRORS[error.details] ? 'warn' : 'error', PROPOSAL_ERRORS[error.details] ?? 'Não foi possível enviar a proposta. Tente novamente.');
    }
    location.reload();
  });
})();
