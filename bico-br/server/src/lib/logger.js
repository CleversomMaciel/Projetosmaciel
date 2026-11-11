// Log estruturado (JSON por linha). Campos sensíveis são removidos antes de escrever.
const REDACT = /token|secret|password|authorization|apikey|api_key|cpf|access_?key/i;

function scrub(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (value instanceof Error) return { name: value.name, message: value.message, code: value.code };
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, REDACT.test(k) ? '[redigido]' : scrub(v, depth + 1)]),
  );
}

export function createLogger({ sink = (line) => process.stdout.write(line + '\n'), silent = false } = {}) {
  const write = (level) => (msg, fields = {}) => {
    if (silent) return;
    sink(JSON.stringify({ t: new Date().toISOString(), level, msg, ...scrub(fields) }));
  };
  return { info: write('info'), warn: write('warn'), error: write('error') };
}
