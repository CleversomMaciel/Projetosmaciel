// Toda configuração vem de variáveis de ambiente. Nada sensível vai para o frontend.
const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);

export function loadConfig(env = process.env) {
  const config = {
    env: env.NODE_ENV || 'development',
    port: int(env.PORT, 3000),
    publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
    trustProxy: int(env.TRUST_PROXY, 0),
    supabase: {
      url: env.SUPABASE_URL || '',
      anonKey: env.SUPABASE_ANON_KEY || '', // pública por definição (protegida por RLS)
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '', // SOMENTE backend
    },
    cnpj: {
      providers: list(env.CNPJ_PROVIDERS, ['brasilapi']),
      timeoutMs: int(env.CNPJ_TIMEOUT_MS, 6000),
      cacheTtlSeconds: int(env.CNPJ_CACHE_TTL_SECONDS, 7 * 24 * 3600),
      serpro: {
        consumerKey: env.SERPRO_CONSUMER_KEY || '',
        consumerSecret: env.SERPRO_CONSUMER_SECRET || '',
        baseUrl: env.SERPRO_BASE_URL || 'https://gateway.apiserpro.serpro.gov.br',
        apiPath: env.SERPRO_CNPJ_PATH || '/consulta-cnpj-df/v2/basica',
      },
    },
    cep: {
      providers: list(env.CEP_PROVIDERS, ['viacep', 'brasilapi']),
      timeoutMs: int(env.CEP_TIMEOUT_MS, 4000),
      cacheTtlSeconds: int(env.CEP_CACHE_TTL_SECONDS, 30 * 24 * 3600),
    },
    mercadoPago: {
      accessToken: env.MP_ACCESS_TOKEN || '',
      webhookSecret: env.MP_WEBHOOK_SECRET || '',
      apiBase: env.MP_API_BASE || 'https://api.mercadopago.com',
    },
    features: {
      allowPfContractors: bool(env.ALLOW_PF_CONTRACTORS, false),
    },
  };
  return config;
}

/** Problemas que impedem subir em produção. Em desenvolvimento viram avisos. */
export function configProblems(config) {
  const problems = [];
  if (!config.supabase.url) problems.push('SUPABASE_URL ausente');
  if (!config.supabase.anonKey) problems.push('SUPABASE_ANON_KEY ausente');
  if (!config.supabase.serviceRoleKey) problems.push('SUPABASE_SERVICE_ROLE_KEY ausente');
  if (!config.mercadoPago.webhookSecret) problems.push('MP_WEBHOOK_SECRET ausente (webhooks serão recusados)');
  if (config.cnpj.providers.includes('serpro') && !config.cnpj.serpro.consumerKey) {
    problems.push('CNPJ_PROVIDERS inclui serpro, mas SERPRO_CONSUMER_KEY/SECRET não foram definidos');
  }
  return problems;
}
