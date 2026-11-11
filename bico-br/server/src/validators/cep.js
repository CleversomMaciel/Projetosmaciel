export const normalizeCep = (input) => String(input ?? '').replace(/[.\-\s]/g, '');
export const isValidCep = (input) => /^[0-9]{8}$/.test(normalizeCep(input)) && normalizeCep(input) !== '00000000';
export const formatCep = (input) => {
  const c = normalizeCep(input);
  return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
};
