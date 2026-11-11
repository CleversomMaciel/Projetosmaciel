-- Bico BR — 0003: projetos freelance, Bico Rápido, vagas remotas, propostas

-- ---------------------------------------------------------------- projetos
-- kind = 'project' (projeto freelance) | 'quick' (Bico Rápido: preço fechado, escopo curto)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  kind text not null default 'project' check (kind in ('project','quick')),
  title text not null check (char_length(title) between 8 and 140),
  description text not null check (char_length(description) between 30 and 10000),
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid references public.subcategories(id) on delete set null,
  budget_type text not null default 'range' check (budget_type in ('fixed','range','open')),
  budget_min_cents bigint check (budget_min_cents >= 0),
  budget_max_cents bigint check (budget_max_cents >= 0),
  deadline_days integer check (deadline_days between 1 and 730),
  deliverables text check (char_length(deliverables) <= 5000),
  hiring_mode text not null default 'per_project' check (hiring_mode in ('per_project','hourly','recurring')),
  experience_level text check (experience_level in ('junior','pleno','senior','especialista')),
  professionals_wanted integer not null default 1 check (professionals_wanted between 1 and 50),
  status text not null default 'draft'
    check (status in ('draft','open','in_progress','completed','closed','cancelled')),
  is_public boolean not null default true,
  published_at timestamptz,
  proposals_count integer not null default 0,
  search tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max_cents is null or budget_min_cents is null or budget_max_cents >= budget_min_cents),
  -- Bico Rápido: preço fechado e prazo curto obrigatórios
  check (kind <> 'quick' or (budget_type = 'fixed' and budget_min_cents is not null
                             and deadline_days is not null and deadline_days <= 15))
);
create trigger projects_updated before update on public.projects
  for each row execute function private.set_updated_at();
create index projects_company_idx on public.projects (company_id);
create index projects_feed_idx on public.projects (published_at desc, id desc)
  where status = 'open' and is_public;
create index projects_category_feed_idx on public.projects (category_id, published_at desc, id desc)
  where status = 'open' and is_public;
create index projects_search_idx on public.projects using gin (search);

create or replace function private.projects_set_published()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'open' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger projects_published before insert or update of status on public.projects
  for each row execute function private.projects_set_published();

create table public.project_skills (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (project_id, skill_id)
);
create index project_skills_skill_idx on public.project_skills (skill_id);

create table public.project_invites (
  project_id uuid not null references public.projects(id) on delete cascade,
  freelancer_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  message text check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  primary key (project_id, freelancer_id)
);
create index project_invites_freelancer_idx on public.project_invites (freelancer_id);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  freelancer_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, freelancer_id)
);

-- ---------------------------------------------------------------- vagas remotas
-- Vagas NÃO passam pelo fluxo de proposta/contrato/comissão. Tabela separada de propósito.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 140),
  description text not null check (char_length(description) between 30 and 15000),
  category_id uuid not null references public.categories(id) on delete restrict,
  requirements text check (char_length(requirements) <= 8000),
  contract_type text not null
    check (contract_type in ('clt','pj','estagio','temporario','freelancer','projeto')),
  -- foco inicial exclusivamente remoto; ampliar exige nova migration consciente
  work_mode text not null default 'remote' check (work_mode = 'remote'),
  salary_min_cents bigint check (salary_min_cents >= 0),
  salary_max_cents bigint check (salary_max_cents >= 0),
  workload text check (char_length(workload) <= 120),
  benefits text check (char_length(benefits) <= 4000),
  experience_level text check (experience_level in ('estagio','junior','pleno','senior','especialista')),
  company_city text, company_uf char(2),
  application_deadline date,
  selection_process text check (char_length(selection_process) <= 4000),
  apply_mode text not null default 'internal' check (apply_mode in ('internal','external')),
  apply_url text check (apply_url ~* '^https://'),
  status text not null default 'draft' check (status in ('draft','open','paused','closed')),
  published_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_max_cents is null or salary_min_cents is null or salary_max_cents >= salary_min_cents),
  check (apply_mode <> 'external' or apply_url is not null)
);
create trigger jobs_updated before update on public.jobs
  for each row execute function private.set_updated_at();
create trigger jobs_published before insert or update of status on public.jobs
  for each row execute function private.projects_set_published();
create index jobs_company_idx on public.jobs (company_id);
create index jobs_feed_idx on public.jobs (published_at desc, id desc) where status = 'open';
create index jobs_filter_idx on public.jobs (category_id, contract_type, published_at desc) where status = 'open';
create index jobs_search_idx on public.jobs using gin (search);

create table public.job_skills (
  job_id uuid not null references public.jobs(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (job_id, skill_id)
);
create index job_skills_skill_idx on public.job_skills (skill_id);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  cover_letter text check (char_length(cover_letter) <= 5000),
  resume_path text,
  status text not null default 'submitted'
    check (status in ('submitted','in_review','interview','rejected','hired','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create trigger job_applications_updated before update on public.job_applications
  for each row execute function private.set_updated_at();
create index job_applications_candidate_idx on public.job_applications (candidate_id);

-- ---------------------------------------------------------------- propostas
-- Inserção somente pela função submit_proposal (controle de cota no servidor).
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  freelancer_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  deadline_days integer not null check (deadline_days between 1 and 730),
  cover_letter text not null check (char_length(cover_letter) between 20 and 5000),
  relevant_experience text check (char_length(relevant_experience) <= 3000),
  portfolio_links jsonb not null default '[]',
  extra_terms text check (char_length(extra_terms) <= 3000),
  status text not null default 'sent'
    check (status in ('sent','shortlisted','accepted','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, freelancer_id)
);
create trigger proposals_updated before update on public.proposals
  for each row execute function private.set_updated_at();
create index proposals_freelancer_idx on public.proposals (freelancer_id, created_at desc);
create index proposals_project_idx on public.proposals (project_id, created_at desc);

-- A empresa só pode alterar o status; o conteúdo da proposta pertence ao freelancer.
create or replace function private.proposals_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> old.freelancer_id
     and not private.is_admin() then
    if (new.amount_cents, new.deadline_days, new.cover_letter, new.relevant_experience,
        new.portfolio_links, new.extra_terms)
       is distinct from
       (old.amount_cents, old.deadline_days, old.cover_letter, old.relevant_experience,
        old.portfolio_links, old.extra_terms) then
      raise exception 'Somente o autor pode alterar o conteúdo da proposta'
        using errcode = '42501';
    end if;
  end if;
  if new.project_id <> old.project_id or new.freelancer_id <> old.freelancer_id then
    raise exception 'Proposta não pode ser transferida' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proposals_guard before update on public.proposals
  for each row execute function private.proposals_guard();

-- Auxiliares SECURITY DEFINER para as políticas RLS: evitam recursão entre as políticas
-- de projects e proposals (uma consulta a outra).
create or replace function private.owns_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p join public.companies c on c.id = p.company_id
                 where p.id = p_project and c.owner_id = (select auth.uid()));
$$;
create or replace function private.has_proposal_on(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.proposals pr
                 where pr.project_id = p_project and pr.freelancer_id = (select auth.uid()));
$$;
create or replace function private.owns_job(p_job uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.jobs j join public.companies c on c.id = j.company_id
                 where j.id = p_job and c.owner_id = (select auth.uid()));
$$;
