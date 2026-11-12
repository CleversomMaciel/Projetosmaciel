do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists "bico_ads_read" on storage.objects';
    execute 'drop policy if exists "bico_ads_insert" on storage.objects';
    execute 'drop policy if exists "bico_ads_delete" on storage.objects';
  end if;
end $$;
drop function if exists public.live_ads(text, uuid, integer);
alter table public.ad_campaigns drop constraint if exists ad_campaigns_live_needs_image;
drop trigger if exists audit_ad_campaigns on public.ad_campaigns;
create trigger audit_ad_campaigns after insert or delete or update of
  advertiser_name, title, body, cta_label, target_url, placement, category_id, starts_at, ends_at, status, price_cents
  on public.ad_campaigns for each row execute function private.audit_row();
alter table public.ad_campaigns drop column if exists image_path, drop column if exists image_alt;
-- campanhas sem título (criadas no formato de imagem) recebem o nome do anunciante antes de voltar a exigir título
update public.ad_campaigns set title = left(advertiser_name, 70) where title is null;
alter table public.ad_campaigns alter column title set not null;
create function public.live_ads(p_placement text, p_category uuid default null, p_limit integer default 3)
returns table (id uuid, advertiser_name text, title text, body text, cta_label text, target_url text, placement text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.advertiser_name, a.title, a.body, a.cta_label, a.target_url, a.placement
    from public.ad_campaigns a
   where a.status = 'active' and a.starts_at <= now() and a.ends_at > now() and a.placement = p_placement
     and (a.category_id is null or p_category is null or a.category_id = p_category)
   order by (a.category_id is not null and a.category_id = p_category) desc, random()
   limit least(greatest(p_limit, 1), 6);
$$;
revoke all on function public.live_ads(text, uuid, integer) from public;
grant execute on function public.live_ads(text, uuid, integer) to anon, authenticated, service_role;
