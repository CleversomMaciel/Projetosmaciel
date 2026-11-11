-- Bico BR — 0005: portfólio, avaliações, chat, denúncias, notificações

-- ---------------------------------------------------------------- portfólio
create table public.portfolio_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index portfolio_collections_user_idx on public.portfolio_collections (user_id);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.freelancer_profiles(user_id) on delete cascade,
  collection_id uuid references public.portfolio_collections(id) on delete set null,
  title text not null check (char_length(title) between 2 and 140),
  description text check (char_length(description) <= 5000),
  results text check (char_length(results) <= 3000),
  -- [{type: image|video|pdf|presentation, bucket, path}] — arquivos no Storage
  media jsonb not null default '[]',
  link_url text check (link_url ~* '^https?://'),
  tools text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  skill_ids uuid[] not null default '{}',
  -- 'bico_br' só é atribuído pelo sistema, a partir de contrato concluído
  origin text not null default 'external' check (origin in ('external','bico_br')),
  contract_id uuid references public.contracts(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','private')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> 'bico_br' or contract_id is not null)
);
create trigger portfolio_items_updated before update on public.portfolio_items
  for each row execute function private.set_updated_at();
create index portfolio_items_user_idx on public.portfolio_items (user_id, is_featured desc, sort_order, created_at desc);

-- ---------------------------------------------------------------- avaliações
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id),
  reviewee_id uuid not null references public.profiles(id),
  reviewee_role text not null check (reviewee_role in ('freelancer','company')),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (contract_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

create or replace function private.reviews_fill_and_aggregate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.contracts;
begin
  select * into c from public.contracts where id = new.contract_id;
  if c.status <> 'completed' then
    raise exception 'Avaliação só é permitida após a conclusão do contrato' using errcode = '42501';
  end if;
  if new.reviewer_id = c.company_user_id then
    new.reviewee_id := c.freelancer_id; new.reviewee_role := 'freelancer';
  elsif new.reviewer_id = c.freelancer_id then
    new.reviewee_id := c.company_user_id; new.reviewee_role := 'company';
  else
    raise exception 'Somente as partes do contrato podem avaliar' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger reviews_before before insert on public.reviews
  for each row execute function private.reviews_fill_and_aggregate();

create or replace function private.reviews_aggregate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c public.contracts;
begin
  if new.reviewee_role = 'freelancer' then
    update public.freelancer_profiles f
       set rating_count = s.n, rating_avg = s.avg
      from (select count(*) n, round(avg(rating), 2) avg from public.reviews
             where reviewee_id = new.reviewee_id and reviewee_role = 'freelancer') s
     where f.user_id = new.reviewee_id;
  else
    select * into c from public.contracts where id = new.contract_id;
    update public.companies co
       set rating_count = s.n, rating_avg = s.avg
      from (select count(*) n, round(avg(r.rating), 2) avg
              from public.reviews r join public.contracts k on k.id = r.contract_id
             where k.company_id = c.company_id and r.reviewee_role = 'company') s
     where co.id = c.company_id;
  end if;
  return new;
end $$;
create trigger reviews_after after insert on public.reviews
  for each row execute function private.reviews_aggregate();

-- ---------------------------------------------------------------- chat
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('project','job','contract')),
  project_id uuid references public.projects(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(project_id, job_id, contract_id) = 1)
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text check (char_length(body) <= 4000),
  -- [{bucket, path, name, size, mime}]
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (body is not null or jsonb_array_length(attachments) > 0)
);
-- paginação por cursor (keyset): conversa + id decrescente
create index messages_conversation_idx on public.messages (conversation_id, id desc);
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function private.is_participant(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_participants p
                 where p.conversation_id = p_conversation and p.user_id = (select auth.uid()));
$$;

-- antispam + bloqueio + atualização da conversa
create or replace function private.messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recent integer;
begin
  select count(*) into v_recent from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'Limite de mensagens por minuto atingido' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.conversation_participants p
      join public.user_blocks b on b.blocker_id = p.user_id and b.blocked_id = new.sender_id
     where p.conversation_id = new.conversation_id) then
    raise exception 'Não é possível enviar mensagens nesta conversa' using errcode = '42501';
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_guard before insert on public.messages
  for each row execute function private.messages_guard();

-- ---------------------------------------------------------------- denúncias / notificações
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in
    ('user','company','project','job','proposal','message','portfolio_item','review')),
  target_id text not null,
  reason text not null check (reason in
    ('fraude','spam','conteudo_improprio','assedio','pagamento_por_fora','dados_falsos','outro')),
  details text check (char_length(details) <= 3000),
  status text not null default 'open' check (status in ('open','in_review','actioned','dismissed')),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, id desc);

-- Realtime: somente mensagens e notificações (RLS decide quem recebe)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
