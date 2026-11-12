-- Bico BR — 0014: anúncios patrocinados de empresas
--
-- Decisões:
--  * Espaços próprios, vendidos por PERÍODO a preço fixo. Impressões e cliques são informativos,
--    não base de cobrança (contadores públicos podem ser inflados; cobrar por clique exigiria antifraude).
--  * Sempre exibidos com o rótulo "Patrocinado". Nunca em contrato, chat ou pagamento.
--  * Sem rede de anúncios de terceiros e sem rastreamento individual: guardamos só totais.
--  * Todo anúncio passa por aprovação de um administrador antes de aparecer.

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  advertiser_name text not null check (char_length(advertiser_name) between 2 and 60),
  title text not null check (char_length(title) between 4 and 70),
  body text check (char_length(body) <= 160),
  cta_label text not null default 'Saiba mais' check (char_length(cta_label) between 2 and 24),
  target_url text not null check (target_url ~* '^https://[^\s<>"'']+$' and char_length(target_url) <= 500),
  placement text not null check (placement in ('home_banner','feed_inline','sidebar')),
  -- segmentação opcional por área; nula = todas
  category_id uuid references public.categories(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  price_cents bigint check (price_cents >= 0),
  internal_note text check (char_length(internal_note) <= 1000),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create trigger ad_campaigns_updated before update on public.ad_campaigns
  for each row execute function private.set_updated_at();
create index ad_campaigns_live_idx on public.ad_campaigns (placement, ends_at) where status = 'active';
create trigger audit_ad_campaigns after insert or update or delete on public.ad_campaigns
  for each row execute function private.audit_row();

-- pedidos de empresas interessadas em anunciar (tratados pelo time comercial)
create table public.ad_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 2 and 120),
  contact text not null check (char_length(contact) between 5 and 160),
  placement text check (placement in ('home_banner','feed_inline','sidebar')),
  message text check (char_length(message) <= 1500),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);
create index ad_requests_status_idx on public.ad_requests (status, created_at);
create trigger ad_requests_cap before insert on public.ad_requests
  for each row execute function private.cap_daily('user_id', '3');

alter table public.ad_campaigns enable row level security;
alter table public.ad_requests enable row level security;
grant all on public.ad_campaigns, public.ad_requests to service_role;

-- público lê só o conteúdo do anúncio vigente (preço, nota interna e contadores ficam fora)
grant select (id, advertiser_name, title, body, cta_label, target_url, placement, category_id, starts_at, ends_at, status)
  on public.ad_campaigns to anon;
grant select, insert, update on public.ad_campaigns to authenticated;
create policy ad_campaigns_public on public.ad_campaigns for select to anon, authenticated
  using (status = 'active' and starts_at <= now() and ends_at > now());
create policy ad_campaigns_admin_select on public.ad_campaigns for select to authenticated
  using (private.has_admin_role('{finance,content}'));
create policy ad_campaigns_admin_insert on public.ad_campaigns for insert to authenticated
  with check (private.has_admin_role('{finance,content}') and created_by = (select auth.uid()));
create policy ad_campaigns_admin_update on public.ad_campaigns for update to authenticated
  using (private.has_admin_role('{finance,content}')) with check (private.has_admin_role('{finance,content}'));

grant select on public.ad_requests to authenticated;
grant insert (user_id, company_name, contact, placement, message) on public.ad_requests to authenticated;
grant update (status) on public.ad_requests to authenticated;
create policy ad_requests_select on public.ad_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{finance,content}'));
create policy ad_requests_insert on public.ad_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy ad_requests_admin_update on public.ad_requests for update to authenticated
  using (private.has_admin_role('{finance,content}')) with check (private.has_admin_role('{finance,content}'));

-- usuários comuns autenticados também só precisam das colunas públicas; como o grant de SELECT
-- para "authenticated" é da tabela inteira (o admin usa), a política pública acima limita as LINHAS
-- e a função abaixo é o caminho recomendado de leitura para o site.
create or replace function public.live_ads(p_placement text, p_category uuid default null, p_limit integer default 3)
returns table (id uuid, advertiser_name text, title text, body text, cta_label text, target_url text, placement text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.advertiser_name, a.title, a.body, a.cta_label, a.target_url, a.placement
    from public.ad_campaigns a
   where a.status = 'active' and a.starts_at <= now() and a.ends_at > now()
     and a.placement = p_placement
     and (a.category_id is null or p_category is null or a.category_id = p_category)
   order by (a.category_id is not null and a.category_id = p_category) desc, random()
   limit least(greatest(p_limit, 1), 6);
$$;

-- contagem agregada, sem identificar quem viu ou clicou
create or replace function public.ad_event(p_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_kind = 'impression' then
    update public.ad_campaigns set impressions = impressions + 1
     where id = p_id and status = 'active' and starts_at <= now() and ends_at > now();
  elsif p_kind = 'click' then
    update public.ad_campaigns set clicks = clicks + 1
     where id = p_id and status = 'active' and starts_at <= now() and ends_at > now();
  end if;
end $$;
-- contadores não disparam auditoria linha a linha (seria ruído): a trilha registra criação e edições de conteúdo
drop trigger audit_ad_campaigns on public.ad_campaigns;
create trigger audit_ad_campaigns after insert or delete or update of
  advertiser_name, title, body, cta_label, target_url, placement, category_id, starts_at, ends_at, status, price_cents
  on public.ad_campaigns for each row execute function private.audit_row();

revoke all on function public.live_ads(text, uuid, integer), public.ad_event(uuid, text) from public;
grant execute on function public.live_ads(text, uuid, integer), public.ad_event(uuid, text) to anon, authenticated, service_role;

-- a tabela não precisa mais ser lida diretamente pelo público: fecha o SELECT de anon
revoke select on public.ad_campaigns from anon;
drop policy ad_campaigns_public on public.ad_campaigns;

-- expira campanhas vencidas junto com a limpeza diária
create or replace function public.purge_expired_cache()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.registry_cache where expires_at < now();
  get diagnostics n = row_count;
  delete from public.external_api_logs where created_at < now() - interval '90 days';
  delete from public.webhook_events where processed_at is not null and received_at < now() - interval '180 days';
  delete from public.notifications where read_at is not null and created_at < now() - interval '180 days';
  update public.ad_campaigns set status = 'ended' where status in ('active','paused') and ends_at <= now();
  return n;
end $$;
revoke all on function public.purge_expired_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_cache() to service_role;
