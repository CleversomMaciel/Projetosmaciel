-- Bico BR — 0004: planos, estado de assinatura, contratos, pagamentos, disputas

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  -- visível para usuários comuns (ex.: percentual de entrada); demais chaves só para admin
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ---------------------------------------------------------------- planos
-- price_cents nulo = plano ainda sem preço definido pelo admin; não pode ser vendido.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  audience text not null default 'freelancer' check (audience in ('freelancer','company')),
  proposals_per_cycle integer check (proposals_per_cycle > 0),
  price_cents bigint check (price_cents > 0),
  cycle_days integer not null default 30 check (cycle_days between 1 and 366),
  features jsonb not null default '[]',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or price_cents is not null)
);
create trigger plans_updated before update on public.plans
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- estado do freelancer
create table public.freelancer_billing (
  user_id uuid primary key references public.freelancer_profiles(user_id) on delete cascade,
  state text not null default 'FREE_UNLIMITED' check (state in (
    'FREE_UNLIMITED','FIRST_PROJECT_ACTIVE','FIRST_PROJECT_COMPLETED',
    'PRO_PENDING_ACTIVATION','PRO_ACTIVE','PRO_EXPIRED','PRO_CANCELLED')),
  plan_id uuid references public.plans(id),
  cycle_start timestamptz,
  cycle_end timestamptz,
  proposals_used integer not null default 0 check (proposals_used >= 0),
  -- consentimento expresso: quando e sobre quais condições (preço/plano exibidos)
  consent_at timestamptz,
  consent_snapshot jsonb,
  provider_subscription_id text,
  updated_at timestamptz not null default now()
);
create trigger freelancer_billing_updated before update on public.freelancer_billing
  for each row execute function private.set_updated_at();

create table public.subscription_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_state text,
  to_state text not null,
  reason text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index subscription_events_user_idx on public.subscription_events (user_id, created_at desc);

create or replace function private.create_freelancer_billing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.freelancer_billing (user_id) values (new.user_id) on conflict do nothing;
  return new;
end $$;
create trigger freelancer_profiles_billing after insert on public.freelancer_profiles
  for each row execute function private.create_freelancer_billing();

-- ---------------------------------------------------------------- contratos
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  proposal_id uuid not null unique references public.proposals(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  company_user_id uuid not null references public.profiles(id) on delete restrict,
  freelancer_id uuid not null references public.profiles(id) on delete restrict,
  scope text not null,
  deliverables text,
  amount_cents bigint not null check (amount_cents > 0),
  deposit_rate numeric(5,4) not null check (deposit_rate >= 0 and deposit_rate <= 1),
  deposit_cents bigint not null check (deposit_cents >= 0),
  balance_cents bigint not null check (balance_cents >= 0),
  deadline_days integer not null,
  due_at timestamptz,
  status text not null default 'awaiting_freelancer' check (status in (
    'awaiting_freelancer','awaiting_deposit','active','delivered','completed','cancelled','disputed')),
  terms_version text not null,
  company_accepted_at timestamptz not null default now(),
  freelancer_accepted_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  is_first_bico boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deposit_cents + balance_cents = amount_cents)
);
create trigger contracts_updated before update on public.contracts
  for each row execute function private.set_updated_at();
create index contracts_freelancer_idx on public.contracts (freelancer_id, created_at desc);
create index contracts_company_idx on public.contracts (company_id, created_at desc);
create index contracts_project_idx on public.contracts (project_id);

create table public.contract_events (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event text not null,
  from_status text,
  to_status text,
  note text,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index contract_events_contract_idx on public.contract_events (contract_id, created_at);

-- ---------------------------------------------------------------- pagamentos
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('deposit','balance','subscription')),
  contract_id uuid references public.contracts(id) on delete restrict,
  plan_id uuid references public.plans(id),
  payer_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in (
    'pending','in_process','approved','rejected','cancelled','refunded','partially_refunded',
    'in_mediation','charged_back')),
  provider text not null default 'mercadopago',
  provider_payment_id text,
  provider_preference_id text,
  provider_status text,
  provider_status_detail text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id),
  check ((kind = 'subscription') = (contract_id is null)),
  check (kind <> 'subscription' or plan_id is not null)
);
create trigger payments_updated before update on public.payments
  for each row execute function private.set_updated_at();
create index payments_contract_idx on public.payments (contract_id);
create index payments_payer_idx on public.payments (payer_id, created_at desc);

-- registro bruto e idempotente de webhooks
create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  dedupe_key text not null,
  event_type text,
  action text,
  resource_id text,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now(),
  unique (provider, dedupe_key)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  reason text not null,
  status text not null default 'requested'
    check (status in ('requested','approved','denied','processed','failed')),
  requested_by uuid not null references public.profiles(id),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_note text,
  provider_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger refunds_updated before update on public.refunds
  for each row execute function private.set_updated_at();
create index refunds_payment_idx on public.refunds (payment_id);

-- ---------------------------------------------------------------- disputas
create sequence public.dispute_protocol_seq;
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique
    default ('BICO-' || to_char(now(), 'YYYY') || '-' ||
             lpad(nextval('public.dispute_protocol_seq')::text, 6, '0')),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  opened_by uuid not null references public.profiles(id),
  reason text not null check (reason in (
    'nao_entrega','entrega_fora_do_escopo','atraso','nao_pagamento','comunicacao','outro')),
  description text not null check (char_length(description) between 20 and 5000),
  status text not null default 'open'
    check (status in ('open','awaiting_response','under_review','resolved','closed')),
  resolution text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  previous_contract_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger disputes_updated before update on public.disputes
  for each row execute function private.set_updated_at();
create index disputes_contract_idx on public.disputes (contract_id);
create index disputes_status_idx on public.disputes (status, created_at);

create table public.dispute_entries (
  id bigint generated always as identity primary key,
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text check (char_length(body) <= 5000),
  file_path text,
  created_at timestamptz not null default now(),
  check (body is not null or file_path is not null)
);
create index dispute_entries_dispute_idx on public.dispute_entries (dispute_id, created_at);

create or replace function private.is_contract_party(p_contract uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contracts c
                 where c.id = p_contract
                   and (select auth.uid()) in (c.freelancer_id, c.company_user_id));
$$;
