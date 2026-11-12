import { $, brl, esc, fmtDate, getClient, getSession, mountChrome, rpcMessage, setBusy, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');
const STATUS = { active: 'Em execução', delivered: 'Entregue', completed: 'Concluído', disputed: 'Reclamação em análise' };
const DSR = { open: 'recebido', in_progress: 'em andamento', done: 'respondido', denied: 'negado' };

// denúncia iniciada a partir de um card: /suporte?denunciar=project:<id>
const pre = (new URLSearchParams(location.search).get('denunciar') ?? '').match(/^(project|job|user|message|review):([0-9a-z-]{1,60})$/i);
if (pre) { $('#alvo-tipo').value = pre[1]; $('#alvo-id').value = pre[2]; $('#form-denuncia').scrollIntoView(); }

(async () => {
  const session = await getSession();
  const { sb } = await getClient();
  const needLogin = () => { location.href = `/entrar?next=${encodeURIComponent(location.pathname + location.search)}`; };

  if (session && sb) {
    const [{ data: contracts }, { data: requests }] = await Promise.all([
      sb.from('contracts').select('id, status, amount_cents, completed_at, projects(title)').in('status', ['active', 'delivered', 'completed', 'disputed']).order('created_at', { ascending: false }).limit(30),
      sb.from('data_subject_requests').select('type, status, created_at').order('created_at', { ascending: false }).limit(10),
    ]);
    $('#contratos').innerHTML = (contracts ?? []).map((c) => `<li class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-creme p-3 ring-1 ring-tinta/[.06]">
      <span><strong>${esc(c.projects?.title)}</strong><span class="block text-xs text-tinta-500">${brl(c.amount_cents)} · ${esc(STATUS[c.status])}${c.completed_at ? ` em ${fmtDate(c.completed_at)}` : ''}</span></span>
      <a class="btn-ghost" href="/contrato?id=${esc(c.id)}#reclamar">${c.status === 'disputed' ? 'Acompanhar reclamação' : 'Abrir reclamação'}</a></li>`).join('')
      || '<li class="text-tinta-500">Você ainda não tem contratos em andamento ou concluídos.</li>';
    $('#meus-pedidos').innerHTML = (requests ?? []).map((r) => `<li>Pedido de ${esc(r.type.replace(/_/g, ' '))} em ${fmtDate(r.created_at)}: ${esc(DSR[r.status])}</li>`).join('');
  }

  $('#form-denuncia').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!session) return needLogin();
    // aceita o link colado: guarda só o identificador
    const raw = $('#alvo-id').value.trim();
    const target = (raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? raw.match(/[?&]u=([a-z0-9-]{3,60})/i)?.[1] ?? raw).slice(0, 80);
    const details = $('#detalhes').value.trim();
    if (target.length < 3) return showNotice(aviso, 'error', 'Informe o link ou a identificação do que está denunciando.');
    if (details.length < 10) return showNotice(aviso, 'error', 'Conte o que aconteceu em pelo menos 10 caracteres.');
    setBusy(ev.submitter, true, 'Enviando…');
    const { error } = await sb.from('reports').insert({ reporter_id: session.user.id, target_type: $('#alvo-tipo').value, target_id: target, reason: $('#motivo').value, details });
    setBusy(ev.submitter, false);
    if (error) return showNotice(aviso, 'error', rpcMessage(error, 'Não foi possível registrar a denúncia.'));
    ev.target.reset();
    showNotice(aviso, 'info', 'Denúncia recebida. Ela é sigilosa e será analisada pela moderação.');
    aviso.scrollIntoView({ block: 'center' });
  });

  $('#form-dados').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!session) return needLogin();
    if ($('#dsr-tipo').value === 'eliminacao' && !confirm('Confirmar o pedido de exclusão da conta e dos dados? Contratos e pagamentos são mantidos pelo prazo exigido por lei.')) return;
    setBusy(ev.submitter, true, 'Enviando…');
    const { error } = await sb.from('data_subject_requests').insert({ user_id: session.user.id, type: $('#dsr-tipo').value, details: $('#dsr-detalhes').value.trim() || null });
    setBusy(ev.submitter, false);
    if (error) return showNotice(aviso, 'error', rpcMessage(error, 'Não foi possível registrar o pedido.'));
    ev.target.reset();
    showNotice(aviso, 'info', 'Pedido registrado. Respondemos em até 15 dias.');
    aviso.scrollIntoView({ block: 'center' });
  });
})();
