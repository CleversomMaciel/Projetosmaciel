import { createClient } from '@supabase/supabase-js';

/**
 * Único ponto do backend que fala com o Supabase usando a service role key.
 * As rotas dependem desta interface (nos testes ela é substituída por um fake em memória).
 */
export function createSupabaseStore({ url, serviceRoleKey, anonKey }) {
  const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Cliente ANÔNIMO para páginas públicas: tudo o que o servidor pré-renderiza passa pela RLS
  // exatamente como um visitante veria. A service role nunca é usada para montar HTML público.
  const pub = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const must = ({ data, error }) => { if (error) throw Object.assign(new Error(error.message), { pg: error }); return data; };

  return {
    async getUserFromToken(token) {
      const { data, error } = await db.auth.getUser(token);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email };
    },
    async getProfile(userId) {
      return must(await db.from('profiles').select('id, account_type, display_name').eq('id', userId).maybeSingle());
    },

    // ---- cache persistente de CNPJ/CEP
    cache: {
      async get(kind, key) {
        const row = must(await db.from('registry_cache').select('payload, expires_at').eq('kind', kind).eq('key', key).maybeSingle());
        return row && new Date(row.expires_at) > new Date() ? row.payload : null;
      },
      async set(kind, key, provider, payload, ttlSeconds) {
        must(await db.from('registry_cache').upsert({
          kind, key, provider, payload,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        }));
      },
    },
    async logExternalCall({ service, provider, outcome, httpStatus, durationMs, error }) {
      await db.from('external_api_logs').insert({
        service, provider, outcome, http_status: httpStatus ?? null, duration_ms: durationMs ?? null,
        error: error ? String(error).slice(0, 500) : null,
      });
    },

    // ---- empresas
    async companyExistsByCnpj(cnpj) {
      return Boolean(must(await db.from('company_private').select('company_id').eq('cnpj', cnpj).maybeSingle()));
    },
    async countCompaniesByOwner(ownerId) {
      const { count, error } = await db.from('companies').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async createCompany({ company, privateData }) {
      const created = must(await db.from('companies').insert(company).select('id, slug').single());
      const { error } = await db.from('company_private').insert({ company_id: created.id, ...privateData });
      if (error) {
        await db.from('companies').delete().eq('id', created.id); // desfaz: sem empresa pela metade
        throw Object.assign(new Error(error.message), { pg: error });
      }
      return created;
    },
    async markOnboarded(userId, { city, uf }) {
      must(await db.from('profiles').update({ onboarded_at: new Date().toISOString(), city, uf }).eq('id', userId));
    },

    // ---- webhooks / pagamentos
    /** @returns {'new'|'pending'|'done'} */
    async registerWebhookEvent({ provider, dedupeKey, eventType, action, resourceId, payload }) {
      const { error } = await db.from('webhook_events').insert({
        provider, dedupe_key: dedupeKey, event_type: eventType, action, resource_id: resourceId, payload,
      });
      if (!error) return 'new';
      if (error.code !== '23505') throw new Error(error.message);
      const row = must(await db.from('webhook_events').select('processed_at').eq('provider', provider).eq('dedupe_key', dedupeKey).single());
      return row.processed_at ? 'done' : 'pending';
    },
    async finishWebhookEvent({ provider, dedupeKey, error }) {
      await db.from('webhook_events')
        .update(error ? { error: String(error).slice(0, 1000) } : { processed_at: new Date().toISOString(), error: null })
        .eq('provider', provider).eq('dedupe_key', dedupeKey);
    },
    async getPaymentForCheckout(paymentId) {
      return must(await db.from('payments')
        .select('id, kind, status, amount_cents, payer_id, contract_id, checkout_url, plans(name), contracts(projects(title))')
        .eq('id', paymentId).maybeSingle());
    },
    async saveCheckout(paymentId, { preferenceId, checkoutUrl }) {
      must(await db.from('payments').update({ provider_preference_id: preferenceId, checkout_url: checkoutUrl })
        .eq('id', paymentId).eq('status', 'pending'));
    },
    async processPaymentUpdate({ paymentId, providerPaymentId, status, statusDetail, amountCents }) {
      return must(await db.rpc('process_payment_update', {
        p_payment_id: paymentId, p_provider_payment_id: providerPaymentId, p_provider_status: status,
        p_status_detail: statusDetail, p_amount_cents: amountCents,
      }));
    },

    // ---- páginas públicas (somente leitura, via papel anon)
    public: {
      async project(id) {
        return must(await pub.from('projects')
          .select('id, kind, title, description, budget_type, budget_min_cents, budget_max_cents, deadline_days, published_at, updated_at, status, categories(name, slug), companies(display_name, uf)')
          .eq('id', id).maybeSingle());
      },
      async freelancer(slug) {
        return must(await pub.from('freelancer_profiles')
          .select('slug, headline, bio, tools, completed_projects, rating_avg, rating_count, updated_at, profiles!freelancer_profiles_user_id_fkey(display_name, city, uf)')
          .eq('slug', slug).maybeSingle());
      },
      async category(slug) {
        return must(await pub.from('categories').select('slug, name, description, seo_title, seo_description').eq('slug', slug).maybeSingle());
      },
    },

    // ---- SEO
    async sitemapEntries(limit = 5000) {
      const [cats, projects, jobs, pros] = await Promise.all([
        db.from('categories').select('slug, updated_at').eq('is_active', true),
        db.from('projects').select('id, updated_at').eq('status', 'open').eq('is_public', true).order('published_at', { ascending: false }).limit(limit),
        db.from('jobs').select('id, updated_at').eq('status', 'open').order('published_at', { ascending: false }).limit(limit),
        db.from('freelancer_profiles').select('slug, updated_at').eq('is_public', true).limit(limit),
      ]);
      return { categories: must(cats), projects: must(projects), jobs: must(jobs), freelancers: must(pros) };
    },
  };
}
