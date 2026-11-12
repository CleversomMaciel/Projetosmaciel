import { $, brl, esc, getClient, getProfile, mountChrome, requireSession, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');
const blocos = $('#blocos');

const BILLING = {
  FREE_UNLIMITED: ['Propostas ilimitadas', 'Você pode enviar propostas sem limite até fechar e concluir o seu primeiro projeto.'],
  FIRST_PROJECT_ACTIVE: ['Primeiro bico em andamento', 'Seu primeiro projeto está em execução, sem assinatura antecipada.'],
  FIRST_PROJECT_COMPLETED: ['Primeiro bico concluído', 'Para enviar novas propostas, escolha um plano Bico BR Pro. Nada é cobrado sem o seu aceite.'],
  PRO_PENDING_ACTIVATION: ['Plano aguardando pagamento', 'Assim que o pagamento for confirmado, seu plano é ativado.'],
  PRO_ACTIVE: ['Bico BR Pro ativo', ''],
  PRO_CANCELLED: ['Plano cancelado', 'Você mantém os benefícios até o fim do ciclo já pago. Contratos em andamento não são afetados.'],
  PRO_EXPIRED: ['Plano expirado', 'Seus contratos em andamento continuam normalmente. Para enviar novas propostas, renove o plano.'],
};
const CONTRACT = {
  awaiting_freelancer: 'Aguardando confirmação do profissional', awaiting_deposit: 'Aguardando pagamento da taxa de serviço',
  active: 'Em execução', delivered: 'Entregue — aguardando aprovação', completed: 'Concluído', cancelled: 'Cancelado', disputed: 'Em análise na Central de Confiança',
};
const PROJECT = { draft: 'Rascunho', open: 'Aberto', in_progress: 'Em andamento', completed: 'Concluído', closed: 'Fechado', cancelled: 'Cancelado' };
const PROPOSAL = { sent: 'Enviada', shortlisted: 'Pré-selecionada', accepted: 'Aceita', rejected: 'Recusada', withdrawn: 'Retirada' };
const card = (title, body) => `<section class="card"><h2 class="font-semibold">${title}</h2><div class="mt-3 space-y-3 text-sm">${body}</div></section>`;
const empty = (t) => `<p class="text-tinta-500">${t}</p>`;

(async () => {
  await requireSession();
  const { sb } = await getClient();
  const profile = await getProfile();
  if (!profile) return showNotice(aviso, 'error', 'Não encontramos seu perfil.');
  if (!profile.onboarded_at) return location.replace('/onboarding');
  $('#saudacao').textContent = `Olá, ${profile.display_name || 'bem-vindo(a)'}`;
  const isCompany = profile.account_type === 'company';
  $('#acoes').innerHTML = (isCompany
    ? '<a class="btn-primary" href="/publicar-projeto">Publicar projeto</a><a class="btn-ghost" href="/publicar-vaga">Publicar vaga</a>'
    : '<a class="btn-primary" href="/projetos">Buscar projetos</a><a class="btn-ghost" href="/perfil">Meu perfil</a>')
    + '<a class="btn-ghost" href="/mensagens">Mensagens</a>';
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
    blocos.innerHTML = card('Meus projetos', (projects ?? []).map((p) => `
      <p><a class="linkish" href="/projeto?id=${p.id}">${esc(p.title)}</a><span class="ml-2 text-tinta-500">${esc(PROJECT[p.status] ?? p.status)} · ${p.proposals_count} proposta(s)</span></p>`).join('') || empty('Você ainda não publicou projetos.'))
      + card('Contratos', contractsHtml);
  } else {
    const [{ data: billing }, { data: proposals }] = await Promise.all([
      sb.from('freelancer_billing').select('state, proposals_used, cycle_end, plans(name, proposals_per_cycle)').maybeSingle(),
      sb.from('proposals').select('id, amount_cents, status, projects(id, title)').eq('freelancer_id', profile.id).order('created_at', { ascending: false }).limit(20),
    ]);
    const [title, text] = BILLING[billing?.state] ?? ['—', ''];
    const quota = billing?.state === 'PRO_ACTIVE' && billing.plans
      ? `${esc(billing.plans.name)}: ${billing.proposals_used} de ${billing.plans.proposals_per_cycle} propostas usadas · renova em ${new Date(billing.cycle_end).toLocaleDateString('pt-BR')}` : text;
    const planCta = ['FIRST_PROJECT_COMPLETED', 'PRO_EXPIRED', 'PRO_PENDING_ACTIVATION', 'PRO_CANCELLED', 'PRO_ACTIVE'].includes(billing?.state)
      ? '<p><a class="btn-ghost" href="/plano">Ver planos</a></p>' : '';
    blocos.innerHTML = card('Meu plano', `<p class="chip">${esc(title)}</p><p>${quota}</p>${planCta}`)
      + card('Minhas propostas', (proposals ?? []).map((p) => `
        <p><a class="linkish" href="/projeto?id=${p.projects?.id}">${esc(p.projects?.title)}</a><span class="ml-2 text-tinta-500">${brl(p.amount_cents)} · ${esc(PROPOSAL[p.status] ?? p.status)}</span></p>`).join('') || empty('Você ainda não enviou propostas.'))
      + card('Contratos', contractsHtml);
  }

})();
