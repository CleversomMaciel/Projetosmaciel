-- Bico BR — 0002: categorias, subcategorias e habilidades (administráveis pelo painel)

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  icon text,
  image_url text,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated before update on public.categories
  for each row execute function private.set_updated_at();

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);
create trigger subcategories_updated before update on public.subcategories
  for each row execute function private.set_updated_at();

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.category_skills (
  category_id uuid not null references public.categories(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (category_id, skill_id)
);
create index category_skills_skill_idx on public.category_skills (skill_id);

create table public.freelancer_skills (
  user_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (user_id, skill_id)
);
create index freelancer_skills_skill_idx on public.freelancer_skills (skill_id);

create table public.freelancer_categories (
  user_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (user_id, category_id)
);
create index freelancer_categories_cat_idx on public.freelancer_categories (category_id);
