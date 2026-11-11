import { $, getClient, mountChrome, setBusy, showNotice, warnIfUnconfigured } from './core.js';

mountChrome();
const aviso = $('#aviso');
warnIfUnconfigured(aviso);

const tipo = new URLSearchParams(location.search).get('tipo');
if (tipo === 'company' || tipo === 'freelancer') $(`input[name="tipo"][value="${tipo}"]`).checked = true;

$('#form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { sb } = await getClient();
  if (!sb) return;
  const nome = $('#nome').value.trim();
  const email = $('#email').value.trim();
  const senha = $('#senha').value;
  if (nome.length < 2) return showNotice(aviso, 'error', 'Informe seu nome.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return showNotice(aviso, 'error', 'Informe um e-mail válido.');
  if (senha.length < 8) return showNotice(aviso, 'error', 'A senha precisa ter pelo menos 8 caracteres.');

  const btn = ev.submitter;
  setBusy(btn, true, 'Criando conta…');
  const { data, error } = await sb.auth.signUp({
    email, password: senha,
    options: {
      data: { account_type: $('input[name="tipo"]:checked').value, display_name: nome },
      emailRedirectTo: `${location.origin}/onboarding`,
    },
  });
  setBusy(btn, false);
  if (error) return showNotice(aviso, 'error', error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível criar a conta. Confira os dados e tente de novo.');
  if (data.session) return location.replace('/onboarding');
  $('#form').hidden = true;
  showNotice(aviso, 'info', 'Enviamos um link de confirmação para o seu e-mail. Abra o link para continuar o cadastro.');
});
