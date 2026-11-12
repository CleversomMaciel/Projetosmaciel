import { $, getClient, getSession, mountChrome, rpcMessage, setBusy, showNotice } from './core.js';

mountChrome();
const aviso = $('#aviso');

$('#form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const session = await getSession();
  if (!session) { location.href = `/entrar?next=${encodeURIComponent('/anuncie')}`; return; }
  const company = $('#empresa').value.trim(); const contact = $('#contato').value.trim();
  if (company.length < 2) return showNotice(aviso, 'error', 'Informe o nome da empresa.');
  if (contact.length < 5) return showNotice(aviso, 'error', 'Informe um e-mail ou telefone para contato.');
  const { sb } = await getClient();
  setBusy(ev.submitter, true, 'Enviando…');
  const { error } = await sb.from('ad_requests').insert({
    user_id: session.user.id, company_name: company, contact, placement: $('#formato').value || null, message: $('#mensagem').value.trim() || null,
  });
  setBusy(ev.submitter, false);
  if (error) return showNotice(aviso, 'error', rpcMessage(error, 'Não foi possível enviar o pedido.'));
  ev.target.reset();
  showNotice(aviso, 'info', 'Pedido recebido. Nossa equipe entra em contato com valores e disponibilidade.');
});
