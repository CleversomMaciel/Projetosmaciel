import { $, getClient, getSession, mountChrome, setBusy, showNotice, warnIfUnconfigured } from './core.js';

mountChrome();
const aviso = $('#aviso');
// só aceitamos destinos internos (evita redirecionamento aberto)
const rawNext = new URLSearchParams(location.search).get('next') || '';
const next = /^\/[a-z0-9\-/?=&%_.]*$/i.test(rawNext) && !rawNext.startsWith('//') ? rawNext : '/painel';

(async () => {
  if (!(await warnIfUnconfigured(aviso))) return;
  if (await getSession()) location.replace(next);
})();

$('#form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { sb } = await getClient();
  if (!sb) return;
  const btn = ev.submitter;
  setBusy(btn, true);
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#senha').value });
  setBusy(btn, false);
  if (error) return showNotice(aviso, 'error', 'E-mail ou senha incorretos, ou e-mail ainda não confirmado.');
  location.replace(next);
});

$('#esqueci').addEventListener('click', async () => {
  const { sb } = await getClient();
  const email = $('#email').value.trim();
  if (!sb) return;
  if (!email) return showNotice(aviso, 'warn', 'Informe seu e-mail no campo acima e clique de novo.');
  await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/entrar` });
  // mesma mensagem exista ou não a conta: não revela quem é cadastrado
  showNotice(aviso, 'info', 'Se houver uma conta com este e-mail, enviaremos as instruções para redefinir a senha.');
});
