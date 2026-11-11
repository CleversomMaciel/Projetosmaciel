// CNPJ numérico e alfanumérico.
// Regra oficial (Receita Federal / Serpro): 12 posições alfanuméricas + 2 dígitos verificadores
// numéricos; cálculo em módulo 11 usando, para cada caractere, o código ASCII menos 48
// (dígitos mantêm o valor; 'A' = 17 ... 'Z' = 42). A mesma regra valida os CNPJs antigos.
const SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;
const W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const W2 = [6, ...W1];

export function normalizeCnpj(input) {
  return String(input ?? '').toUpperCase().replace(/[.\/\-\s]/g, '');
}

function checkDigit(chars, weights) {
  const sum = weights.reduce((acc, w, i) => acc + (chars.charCodeAt(i) - 48) * w, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(input) {
  const cnpj = normalizeCnpj(input);
  if (!SHAPE.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false; // 00000000000000, 11111111111111...
  const d1 = checkDigit(cnpj, W1);
  const d2 = checkDigit(cnpj.slice(0, 12) + d1, W2);
  return cnpj.endsWith(`${d1}${d2}`);
}

export const isAlphanumericCnpj = (input) => /[A-Z]/.test(normalizeCnpj(input));

export function formatCnpj(input) {
  const c = normalizeCnpj(input);
  if (c.length !== 14) return c;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** Exibição pública parcial: mantém só os 2 primeiros caracteres e o número do estabelecimento. */
export function maskCnpj(input) {
  const c = normalizeCnpj(input);
  if (c.length !== 14) return null;
  return `${c.slice(0, 2)}.***.***/${c.slice(8, 12)}-**`;
}
