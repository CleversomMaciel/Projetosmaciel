import { $, getClient, honeypotFilled, mountCaptcha, mountChrome, setBusy, showNotice, warnIfUnconfigured } from './core.js';

mountChrome();
const aviso = $('#aviso');
warnIfUnconfigured(aviso);
const captchaReady = mountCaptcha($('#captcha'));

const tipo = new URLSearchParams(location.search).get('tipo');
if (tipo === 'company' || tipo === 'freelancer') $(`input[name="tipo"][value="${tipo}"]`).checked = true;
const syncCoupon = () => { $('#campo-cupom').hidden = $('input[name="tipo"]:checked').value !== 'freelancer'; };
document.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', syncCoupon));
syncCoupon();

$('#form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { sb } = await getClient();
  if (!sb) return;
  if (honeypotFilled(ev.target)) return; // robô: ignora sem dar pistas
  const captcha = await captchaReady;
  if (captcha && !captcha.token()) return showNotice(aviso, 'error', 'Confirme que você não é um robô.');
  const nome = $('#nome').value.trim();
  const email = $('#email').value.trim();
  const senha = $('#senha').value;
  if (nome.length < 2) return showNotice(aviso, 'error', 'Informe seu nome.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return showNotice(aviso, 'error', 'Informe um e-mail válido.');
  if (senha.length < 8) return showNotice(aviso, 'error', 'A senha precisa ter pelo menos 8 caracteres.');

  // o cupom é aplicado depois que o perfil existe (no fim do cadastro); até lá fica só neste navegador
  const coupon = $('#cupom').value.trim().toUpperCase();
  try { if (coupon && $('input[name="tipo"]:checked').value === 'freelancer') sessionStorage.setItem('bico-cupom', coupon); else sessionStorage.removeItem('bico-cupom'); } catch { /* armazenamento indisponível */ }
  const btn = ev.submitter;
  setBusy(btn, true, 'Criando conta…');
  const { data, error } = await sb.auth.signUp({
    email, password: senha,
    options: {
      data: { account_type: $('input[name="tipo"]:checked').value, display_name: nome },
      emailRedirectTo: `${location.origin}/onboarding`,
      ...(captcha ? { captchaToken: captcha.token() } : {}),
    },
  });
  setBusy(btn, false);
  captcha?.reset();
  if (error) return showNotice(aviso, 'error', error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não foi possível criar a conta. Confira os dados e tente de novo.');
  if (data.session) return location.replace('/onboarding');
  $('#form').hidden = true;
  showNotice(aviso, 'info', 'Enviamos um link de confirmação para o seu e-mail. Abra o link para continuar o cadastro.');
});
