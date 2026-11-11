-- Bico BR — 0001: identidade, perfis, empresas, administração
-- Reversão: supabase/rollback/20261111000100_base_identidade.down.sql

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- admin
create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','finance','support','moderation','content')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_members m where m.user_id = (select auth.uid()));
$$;

create or replace function private.has_admin_role(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_members m
    where m.user_id = (select auth.uid())
      and (m.role = 'super_admin' or m.role = any (p_roles))
  );
$$;

-- ---------------------------------------------------------------- perfis
-- Dados públicos mínimos. Dados pessoais ficam em profile_private.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('freelancer','company')),
  display_name text not null default '' check (char_length(display_name) <= 120),
  avatar_url text,
  city text check (char_length(city) <= 120),
  uf char(2),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text check (char_length(full_name) <= 160),
  cpf text check (cpf ~ '^[0-9]{11}$'),
  phone text check (char_length(phone) <= 20),
  birth_date date,
  cep text check (cep ~ '^[0-9]{8}$'),
  street text, number text, complement text, district text,
  city text, uf char(2), ibge_code text check (ibge_code ~ '^[0-9]{7}$'),
  address_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger profile_private_updated before update on public.profile_private
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- freelancer
create table public.freelancer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  headline text check (char_length(headline) <= 140),
  bio text check (char_length(bio) <= 5000),
  cover_url text,
  availability text check (availability in ('full_time','part_time','weekends','unavailable')),
  hourly_rate_cents bigint check (hourly_rate_cents >= 0),
  links jsonb not null default '[]',
  languages jsonb not null default '[]',
  tools text[] not null default '{}',
  experience jsonb not null default '[]',
  education jsonb not null default '[]',
  certifications jsonb not null default '[]',
  -- exposição pública (e indexação por buscadores) é opt-in
  is_public boolean not null default false,
  -- agregados mantidos pelo sistema; usuário não tem permissão de escrita
  completed_projects integer not null default 0,
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger freelancer_profiles_updated before update on public.freelancer_profiles
  for each row execute function private.set_updated_at();
create index freelancer_profiles_public_idx on public.freelancer_profiles (is_public) where is_public;

-- ---------------------------------------------------------------- empresas
-- companies: dados de vitrine. company_private: dados cadastrais/fiscais.
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  person_type text not null check (person_type in ('pj','pf')),
  display_name text not null check (char_length(display_name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$'),
  logo_url text,
  description text check (char_length(description) <= 5000),
  segment text check (char_length(segment) <= 120),
  website text check (website ~* '^https?://'),
  city text, uf char(2),
  -- exibição parcial do CNPJ, calculada no servidor
  cnpj_masked text,
  registry_status text,
  registry_checked_at timestamptz,
  is_public boolean not null default true,
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_updated before update on public.companies
  for each row execute function private.set_updated_at();
create index companies_owner_idx on public.companies (owner_id);

create table public.company_private (
  company_id uuid primary key references public.companies(id) on delete cascade,
  -- 14 caracteres normalizados; aceita o formato alfanumérico (12 alfanum. + 2 DV numéricos)
  cnpj text unique check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  cpf text check (cpf ~ '^[0-9]{11}$'),
  legal_name text,
  trade_name text,
  opened_at date,
  legal_nature text,
  company_size text,
  main_cnae jsonb,
  secondary_cnaes jsonb not null default '[]',
  registry_provider text,
  registry_phone text,
  registry_email text,
  cep text check (cep ~ '^[0-9]{8}$'),
  street text, number text, complement text, district text,
  city text, uf char(2), ibge_code text check (ibge_code ~ '^[0-9]{7}$'),
  contact_phone text, contact_email text,
  address_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger company_private_updated before update on public.company_private
  for each row execute function private.set_updated_at();

create or replace function private.owns_company(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.companies c
                 where c.id = p_company and c.owner_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------- novo usuário
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'freelancer');
  v_name text := left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120);
begin
  if v_type not in ('freelancer','company') then
    v_type := 'freelancer';
  end if;
  insert into public.profiles (id, account_type, display_name) values (new.id, v_type, v_name);
  insert into public.profile_private (user_id) values (new.id);
  if v_type = 'freelancer' then
    insert into public.freelancer_profiles (user_id, slug)
    values (new.id, 'p-' || replace(new.id::text, '-', ''));
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
