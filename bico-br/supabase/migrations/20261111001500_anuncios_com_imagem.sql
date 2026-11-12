-- Bico BR — 0015: anúncio é um BANNER DE IMAGEM enviado pelo anunciante
--
-- A empresa procura o Bico BR, contrata o espaço e envia a arte. Um administrador sobe a imagem
-- e coloca a campanha no ar. Segurança:
--  * só PNG, JPEG e WebP (SVG é recusado: pode carregar script);
--  * limite de 2 MB por arquivo;
--  * só administradores (finance/content, com MFA) enviam ou apagam imagens;
--  * campanha não entra no ar sem imagem e sem texto alternativo (acessibilidade).

alter table public.ad_campaigns
  add column image_path text check (image_path ~ '^[a-z0-9][a-z0-9/_-]{0,180}\.(png|jpg|jpeg|webp)$'),
  add column image_alt text check (char_length(image_alt) between 4 and 160);
alter table public.ad_campaigns
  add constraint ad_campaigns_live_needs_image check (status <> 'active' or (image_path is not null and image_alt is not null));
alter table public.ad_campaigns alter column title drop not null;

drop function public.live_ads(text, uuid, integer);
create function public.live_ads(p_placement text, p_category uuid default null, p_limit integer default 3)
returns table (id uuid, advertiser_name text, image_path text, image_alt text, target_url text, placement text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.advertiser_name, a.image_path, a.image_alt, a.target_url, a.placement
    from public.ad_campaigns a
   where a.status = 'active' and a.starts_at <= now() and a.ends_at > now()
     and a.image_path is not null and a.placement = p_placement
     and (a.category_id is null or p_category is null or a.category_id = p_category)
   order by (a.category_id is not null and a.category_id = p_category) desc, random()
   limit least(greatest(p_limit, 1), 6);
$$;
revoke all on function public.live_ads(text, uuid, integer) from public;
grant execute on function public.live_ads(text, uuid, integer) to anon, authenticated, service_role;

drop trigger audit_ad_campaigns on public.ad_campaigns;
create trigger audit_ad_campaigns after insert or delete or update of
  advertiser_name, title, body, cta_label, target_url, placement, category_id, starts_at, ends_at, status, price_cents, image_path, image_alt
  on public.ad_campaigns for each row execute function private.audit_row();

-- Storage: bucket público de leitura, escrita só por administradores.
-- NÃO validado em Postgres local (schema storage só existe no Supabase): validar em homologação.
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    raise notice 'Schema storage ausente: bucket de anúncios não criado (ambiente local).';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ads', 'ads', true, 2097152, array['image/png','image/jpeg','image/webp'])
  on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/png','image/jpeg','image/webp'];
  execute $p$create policy "bico_ads_read" on storage.objects for select to anon, authenticated using (bucket_id = 'ads')$p$;
  execute $p$create policy "bico_ads_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'ads' and private.has_admin_role('{finance,content}'))$p$;
  execute $p$create policy "bico_ads_delete" on storage.objects for delete to authenticated
    using (bucket_id = 'ads' and private.has_admin_role('{finance,content}'))$p$;
end $$;
