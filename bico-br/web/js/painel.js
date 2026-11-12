import { $, brl, esc, getClient, getProfile, icon, mountChrome, requireSession, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');
const blocos = $('#blocos');

const BILLING = {
  FREE_UNLIMITED: ['Propostas ilimitadas', 'Você pode enviar propostas sem limite até fechar e concluir o seu primeiro projeto.'],
  FIRST_PROJECT_ACTIVE: ['Primeiro bico em andamento', 'Seu primeiro projeto está em execução, sem assinatura antecipada.'],
  FIRST_PROJECT_COMPLETED: ['Primeiro bico concluído', 'Para continuar enviando propostas, assine o Bico BR Pro: valor fixo por mês, projetos ilimitados. Nada é cobrado sem o seu aceite.'],
  PRO_PENDING_ACTIVATION: ['Plano aguardando pagamento', 'Assim que o pagamento for confirmado, seu plano é ativado.'],
  PRO_ACTIVE: ['Bico BR Pro ativo', ''],
  PRO_CANCELLED: ['Plano cancelado', 'Você mantém os benefícios até o fim do ciclo já pago. Contratos em andamento não são afetados.'],
  PRO_EXPIRED: ['Plano expirado', 'Seus contratos em andamento continuam normalmente. Para enviar novas propostas, renove o plano.'],
};
const CONTRACT = {
  awaiting_freelancer: 'Aguardando confirmação do profissional', awaiting_deposit: 'Aguardando pagamento da empresa',
  active: 'Em execução', delivered: 'Entregue — aguardando aprovação', completed: 'Concluído', cancelled: 'Cancelado', disputed: 'Em análise na Central de Confiança',
};
const PROJECT = { draft: 'Rascunho', open: 'Aberto', in_progress: 'Em andamento', completed: 'Concluído', closed: 'Fechado', cancelled: 'Cancelado' };
const PROPOSAL = { sent: 'Enviada', shortlisted: 'Pré-selecionada', accepted: 'Aceita', rejected: 'Recusada', withdrawn: 'Retirada' };
const card = (title, body) => `<section class="card"><h2 class="font-display text-lg font-bold">${title}</h2><div class="mt-3 space-y-3 text-sm">${body}</div></section>`;
const empty = (t) => `<p class="text-tinta-500">${t}</p>`;

(async () => {
  await requireSession();
  const { sb } = await getClient();
  const profile = await getProfile();
  if (!profile) return showNotice(aviso, 'error', 'Não encontramos seu perfil.');
  if (!profile.onboarded_at) return location.replace('/onboarding');
  $('#saudacao').textContent = `Olá, ${(profile.display_name || '').split(' ')[0] || 'bem-vindo(a)'}! 👋`;
  const cupom = new URLSearchParams(location.search).get('cupom');
  if (cupom === 'invalido') showNotice(aviso, 'warn', 'O cupom informado no cadastro é inválido ou já acabou. Você pode tentar outro em Minha assinatura.');
  else if (/^\d{1,2}$/.test(cupom ?? '')) showNotice(aviso, 'info', `Cupom aplicado: ${cupom} dias de assinatura grátis, contados a partir do fim do seu primeiro projeto. Até lá, propostas ilimitadas.`);
  const isCompany = profile.account_type === 'company';
  // menu lateral (desktop); no celular a barra inferior do app cumpre esse papel
  const link = (href, ic, label, extra = '') => `<a class="side-link" href="${href}"${href === '/painel' ? ' aria-current="page"' : ''}>${icon(ic)}<span class="flex-1">${label}</span>${extra}</a>`;
  const menuHtml = (unread) => [
    link('/painel', 'home', 'Início'),
    isCompany ? link('/publicar-projeto', 'briefcase', 'Publicar projeto') : link('/projetos', 'layers', 'Buscar projetos'),
    isCompany ? link('/profissionais', 'users', 'Profissionais') : link('/perfil', 'user', 'Meu perfil'),
    link('/mensagens', 'chat', 'Mensagens', unread ? `<span class="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-mata-500 px-1 text-[11px] font-bold text-white">${unread}</span>` : ''),
    link('/vitrine', 'star', 'Vitrine'),
    isCompany ? '' : link('/plano', 'wallet', 'Assinatura'),
    link('/suporte', 'shield', 'Ajuda e reclamações'),
  ].join('') + `<div class="mt-3 border-t border-white/10 pt-3">${isCompany ? '<a class="btn-primary w-full" href="/publicar-projeto">Publicar projeto</a>' : '<a class="btn-glass w-full border-sol-400 text-sol-400" href="/plano">Plano Pro</a>'}</div>`;
  const stat = (ic, value, label) => `<li class="stat"><span class="stat-icon">${icon(ic)}</span><strong class="font-display text-2xl font-extrabold text-marinho-900">${value}</strong><span class="text-xs text-tinta-500">${label}</span></li>`;
  const { data: parts } = await sb.from('conversation_participants').select('last_read_at, conversations(last_message_at)').eq('user_id', profile.id).limit(100);
  const unread = (parts ?? []).filter((p) => p.conversations?.last_message_at && (!p.last_read_at || p.conversations.last_message_at > p.last_read_at)).length;
  $('#menu').innerHTML = menuHtml(unread);
  $('#acoes').innerHTML = (isCompany
    ? '<a class="btn-primary" href="/publicar-projeto">Publicar projeto</a><a class="btn-ghost lg:hidden" href="/profissionais">Buscar devs</a>'
    : '<a class="btn-primary" href="/projetos">Buscar projetos</a><a class="btn-ghost lg:hidden" href="/perfil">Meu perfil</a>')
    + '<a class="btn-ghost lg:hidden" href="/mensagens">Mensagens</a><a class="btn-ghost lg:hidden" href="/suporte">Ajuda e reclamações</a>'; // no desktop o menu lateral já tem esses atalhos
  $('#acoes').className = 'flex flex-wrap gap-2';

  const { data: contracts } = await sb.from('contracts')
    .select('id, status, amount_cents, deposit_cents, due_at, projects(title)').order('created_at', { ascending: false }).limit(20);
  const contractsHtml = (contracts ?? []).map((c) => `
    <div class="border-t border-tinta/10 pt-3 first:border-0 first:pt-0">
      <p><a class="linkish" href="/contrato?id=${c.id}">${esc(c.projects?.title)}</a></p>
      <p class="text-tinta-500">${brl(c.amount_cents)} · ${esc(CONTRACT[c.status] ?? c.status)}</p>
    </div>`).join('') || empty('Nenhum contrato ainda.');

  if (isCompany) {
    const { data: company } = await sb.from('companies').select('id').eq('owner_id', profile.id).maybeSingle();
    const { data: projects } = company ? await sb.from('projects').select('id, title, status, proposals_count').eq('company_id', company.id).order('created_at', { ascending: false }).limit(20) : { data: [] };
    const openCount = (projects ?? []).filter((p) => p.status === 'open').length;
    const received = (projects ?? []).reduce((n, p) => n + (p.proposals_count || 0), 0);
    const activeC = (contracts ?? []).filter((c) => ['active', 'delivered', 'awaiting_deposit', 'awaiting_freelancer'].includes(c.status)).length;
    $('#stats').innerHTML = stat('briefcase', openCount, 'Projetos abertos') + stat('layers', received, 'Propostas recebidas') + stat('check', activeC, 'Contratos em andamento') + stat('chat', unread, 'Conversas não lidas');
    blocos.innerHTML = card('Meus projetos', (projects ?? []).map((p) => `
      <p><a class="linkish" href="/projeto?id=${p.id}">${esc(p.title)}</a><span class="ml-2 text-tinta-500">${esc(PROJECT[p.status] ?? p.status)} · ${p.proposals_count} proposta(s)</span></p>`).join('') || empty('Você ainda não publicou projetos.'))
      + card('Contratos', contractsHtml);
  } else {
    const PAYOUT = { held: 'Em processamento', blocked: 'Em análise', released: 'Em processamento', paid: 'Pago na sua conta Mercado Pago', refunded: 'Devolvido à empresa' };
    const [{ data: billing }, { data: proposals }, { data: payouts }] = await Promise.all([
      sb.from('freelancer_billing').select('state, proposals_used, cycle_end, trial_days_pending, plans(name, proposals_per_cycle)').maybeSingle(),
      sb.from('proposals').select('id, amount_cents, status, projects(id, title)').eq('freelancer_id', profile.id).order('created_at', { ascending: false }).limit(20),
      sb.from('payouts').select('contract_id, amount_cents, status').eq('freelancer_id', profile.id).order('created_at', { ascending: false }).limit(20),
    ]);
    const { data: fpMp } = await sb.from('freelancer_profiles').select('mp_connected').eq('user_id', profile.id).maybeSingle();
    let blocosTop = '';
    const [title, text] = BILLING[billing?.state] ?? ['—', ''];
    const quota = billing?.state === 'PRO_ACTIVE' && billing.plans
      ? `${esc(billing.plans.name)}: ${billing.plans.proposals_per_cycle ? `${billing.proposals_used} de ${billing.plans.proposals_per_cycle} propostas usadas` : 'propostas e projetos ilimitados'} · válido até ${new Date(billing.cycle_end).toLocaleDateString('pt-BR')}` : text;
    const daysLeft = billing?.cycle_end ? Math.ceil((new Date(billing.cycle_end) - Date.now()) / 86400000) : null;
    const expiring = billing?.state === 'PRO_ACTIVE' && daysLeft !== null && daysLeft <= 7;
    const planCta = (expiring ? `<p class="notice-warn">Sua assinatura vence em ${Math.max(daysLeft, 0)} dia${daysLeft === 1 ? '' : 's'}. Ela não renova sozinha.</p>` : '')
      + (['FIRST_PROJECT_COMPLETED', 'PRO_EXPIRED', 'PRO_PENDING_ACTIVATION', 'PRO_CANCELLED', 'PRO_ACTIVE'].includes(billing?.state)
        ? `<p><a class="${expiring || billing.state !== 'PRO_ACTIVE' ? 'btn-primary' : 'btn-ghost'}" href="/plano">${expiring ? 'Renovar agora' : 'Ver assinatura'}</a></p>` : '<p><a class="linkish text-sm" href="/plano">Tem um cupom?</a></p>');
    if (!fpMp?.mp_connected) blocosTop = '<p class="notice-warn xl:col-span-2">Conecte sua conta do Mercado Pago em <a class="linkish" href="/perfil">Meu perfil</a> para poder confirmar contratos e receber.</p>';
    const { data: me } = await sb.from('freelancer_profiles').select('rating_avg, rating_count, completed_projects').eq('user_id', profile.id).maybeSingle();
    const activeC = (contracts ?? []).filter((c) => ['active', 'delivered', 'awaiting_deposit', 'awaiting_freelancer'].includes(c.status)).length;
    $('#stats').innerHTML = stat('layers', (proposals ?? []).length, 'Propostas enviadas') + stat('briefcase', activeC, 'Projetos em andamento')
      + stat('check', me?.completed_projects ?? 0, 'Projetos concluídos') + stat('star', me?.rating_count ? Number(me.rating_avg).toFixed(1) : '—', 'Sua avaliação');
    blocos.innerHTML = blocosTop + card('Minha assinatura', `<p class="chip">${esc(title)}</p><p>${quota}</p>${planCta}`)
      + card('Minhas propostas', (proposals ?? []).map((p) => `
        <p><a class="linkish" href="/projeto?id=${p.projects?.id}">${esc(p.projects?.title)}</a><span class="ml-2 text-tinta-500">${brl(p.amount_cents)} · ${esc(PROPOSAL[p.status] ?? p.status)}</span></p>`).join('') || empty('Você ainda não enviou propostas.'))
      + card('Recebimentos', (payouts ?? []).map((p) => `<p><a class="linkish" href="/contrato?id=${p.contract_id}">${brl(p.amount_cents)}</a><span class="ml-2 text-tinta-500">${esc(PAYOUT[p.status] ?? p.status)}</span></p>`).join('') || empty('Seus recebimentos aparecem aqui quando um cliente paga um projeto.'))
      + card('Contratos', contractsHtml);
  }

})();
