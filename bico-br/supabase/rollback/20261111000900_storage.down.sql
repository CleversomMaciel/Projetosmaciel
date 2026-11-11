drop policy if exists "bico_public_read" on storage.objects;
drop policy if exists "bico_owner_read" on storage.objects;
drop policy if exists "bico_chat_read" on storage.objects;
drop policy if exists "bico_chat_insert" on storage.objects;
drop policy if exists "bico_owner_insert" on storage.objects;
drop policy if exists "bico_owner_update" on storage.objects;
drop policy if exists "bico_owner_delete" on storage.objects;
-- buckets não são removidos automaticamente: contêm arquivos de usuários.
