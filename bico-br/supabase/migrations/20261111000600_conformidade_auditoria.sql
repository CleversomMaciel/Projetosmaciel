-- Bico BR — 0006: consentimentos, direitos do titular (LGPD), auditoria, cache e logs de APIs, indicação

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in
    ('termos_freelancer','termos_empresa','termos_candidato','privacidade','assinatura_pro','contrato_servico')),
  version text not null,
  title text not null,
  body text not null,
  -- só entra em vigor depois de revisão por advogado(a)
  legal_review_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (doc_type, version)
);

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null,
  doc_version text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  unique (user_id, doc_type, doc_version)
);

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in
    ('acesso','correcao','eliminacao','portabilidade','revogacao_consentimento','informacao')),
  details text check (char_length(details) <= 3000),
  status text not null default 'open' check (status in ('open','in_progress','done','denied')),
  response text,
  handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index dsr_status_idx on public.data_subject_requests (status, created_at);

-- trilha de auditoria: somente inserção
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function private.audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs é somente inserção' using errcode = '42501';
end $$;
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.audit_immutable();

-- auditoria automática das tabelas financeiras e jurídicas
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after)
  values (
    (select auth.uid()),
    coalesce(current_setting('request.jwt.claim.role', true), current_user),
    lower(tg_op), tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id',
             to_jsonb(new) ->> 'user_id', to_jsonb(new) ->> 'key'),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_contracts after insert or update or delete on public.contracts
  for each row execute function private.audit_row();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function private.audit_row();
create trigger audit_refunds after insert or update or delete on public.refunds
  for each row execute function private.audit_row();
create trigger audit_disputes after insert or update or delete on public.disputes
  for each row execute function private.audit_row();
create trigger audit_billing after insert or update or delete on public.freelancer_billing
  for each row execute function private.audit_row();
create trigger audit_plans after insert or update or delete on public.plans
  for each row execute function private.audit_row();
create trigger audit_settings after insert or update or delete on public.platform_settings
  for each row execute function private.audit_row();
create trigger audit_admins after insert or update or delete on public.admin_members
  for each row execute function private.audit_row();

-- cache compartilhado das consultas de CNPJ/CEP (apenas o backend acessa)
create table public.registry_cache (
  kind text not null check (kind in ('cnpj','cep')),
  key text not null,
  provider text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (kind, key)
);
create index registry_cache_expiry_idx on public.registry_cache (expires_at);

create table public.external_api_logs (
  id bigint generated always as identity primary key,
  service text not null,
  provider text not null,
  outcome text not null check (outcome in ('ok','not_found','error','timeout','rate_limited','cache_hit')),
  http_status integer,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index external_api_logs_idx on public.external_api_logs (service, created_at desc);

-- ---------------------------------------------------------------- indicação
create table public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

-- recompensa só é liberada quando o indicado conclui um contrato pago (status 'qualified'),
-- nunca no cadastro: reduz o incentivo a contas falsas.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','qualified','rewarded','rejected')),
  qualified_contract_id uuid references public.contracts(id),
  signup_ip inet,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create trigger referrals_updated before update on public.referrals
  for each row execute function private.set_updated_at();
create index referrals_referrer_idx on public.referrals (referrer_id);
