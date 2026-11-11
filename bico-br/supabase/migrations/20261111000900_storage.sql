-- Bico BR — 0009: buckets e políticas do Supabase Storage.
-- Convenção de caminho: <auth.uid()>/<arquivo>. Buckets privados usam URL assinada.
-- NÃO validado em Postgres local (schema storage só existe no Supabase): validar em homologação.
do $$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'storage' and table_name = 'buckets') then
    raise notice 'Schema storage ausente: migration de storage ignorada (ambiente local).';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
    ('portfolio-public', 'portfolio-public', true, 52428800,
       array['image/jpeg','image/png','image/webp','video/mp4','application/pdf']),
    ('portfolio-private', 'portfolio-private', false, 52428800,
       array['image/jpeg','image/png','image/webp','video/mp4','application/pdf',
             'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
    ('chat-attachments', 'chat-attachments', false, 20971520, null),
    ('documents', 'documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
  on conflict (id) do nothing;

  execute $p$create policy "bico_public_read" on storage.objects for select to anon, authenticated
    using (bucket_id in ('avatars','portfolio-public'))$p$;
  execute $p$create policy "bico_owner_read" on storage.objects for select to authenticated
    using (bucket_id in ('portfolio-private','documents')
           and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  -- anexos do chat: caminho <conversation_id>/<uid>/<arquivo>; só participantes leem
  execute $p$create policy "bico_chat_read" on storage.objects for select to authenticated
    using (bucket_id = 'chat-attachments'
           and private.is_participant(((storage.foldername(name))[1])::uuid))$p$;
  execute $p$create policy "bico_chat_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'chat-attachments'
                and private.is_participant(((storage.foldername(name))[1])::uuid)
                and (storage.foldername(name))[2] = (select auth.uid())::text)$p$;
  execute $p$create policy "bico_owner_insert" on storage.objects for insert to authenticated
    with check (bucket_id in ('avatars','portfolio-public','portfolio-private','documents')
                and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "bico_owner_update" on storage.objects for update to authenticated
    using (bucket_id in ('avatars','portfolio-public','portfolio-private','documents')
           and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  execute $p$create policy "bico_owner_delete" on storage.objects for delete to authenticated
    using (bucket_id in ('avatars','portfolio-public','portfolio-private','documents')
           and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
end $$;
