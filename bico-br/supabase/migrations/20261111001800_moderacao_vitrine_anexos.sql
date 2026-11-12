-- Bico BR — 0018: conduta (contato por fora e ofensas), suspensão, tempo de resposta,
-- anexos do chat e vitrine de publicações com curtidas.
--
-- Regras definidas pela direção:
--  * É proibido divulgar telefone, e-mail, redes sociais ou aplicativos de mensagem na plataforma.
--  * Linguagem ofensiva é recusada.
--  * Arquivos para iniciar ou tocar um projeto circulam pelo chat da plataforma.
--  * Quem insiste em violar é suspenso automaticamente e passa por revisão da moderação.
-- Limite honesto: filtro por padrões não pega todo disfarce e pode barrar texto legítimo.
-- Por isso toda ocorrência fica registrada para revisão humana e a suspensão pode ser desfeita.

-- ---------------------------------------------------------------- análise de texto
create or replace function private.moderate_text(p_text text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text; k text; squeezed text;
begin
  if p_text is null or btrim(p_text) = '' then return null; end if;
  v := lower(translate(p_text,
        'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'));
  -- e-mail (inclusive "fulano arroba gmail ponto com")
  if v ~ '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sarroba\s)\s*[a-z0-9-]+\s*(\.|\(dot\)|\sponto\s)\s*[a-z]{2,}' then return 'contato_email'; end if;
  -- telefone: 10 a 13 dígitos seguidos, com separadores comuns
  if v ~ '(^|[^0-9])(\+?[0-9][ ().-]{0,2}){10,13}($|[^0-9])' then return 'contato_telefone'; end if;
  -- links de mensageiros, encurtadores e agregadores de links
  if v ~ '(wa\.me|api\.whatsapp|chat\.whatsapp|t\.me/|telegram\.me|bit\.ly|tinyurl|linktr\.ee|encurtador|cutt\.ly|instagram\.com|facebook\.com|fb\.com|linkedin\.com|discord\.gg|discord\.com|tiktok\.com|twitter\.com|x\.com/)' then return 'contato_link'; end if;
  -- usuário de rede social (@fulano)
  if v ~ '(^|[\s(:,;])@[a-z0-9_.]{3,}' then return 'contato_rede'; end if;
  -- troca comum de letras por números/símbolos (wh4ts4pp, 1nst4)
  k := translate(v, '0134578$', 'oieastbs');
  if k ~ '\m(whatsapp|whats|whatsap|watsapp|wpp|zap|zapzap|zapp|telegram|telegran|instagram|insta|facebook|messenger|discord|skype|tiktok|linkedin|twitter|snapchat|gmail|hotmail|outlook|yahoo)\M' then return 'contato_rede'; end if;
  -- letras espaçadas ou pontuadas (w h a t s a p p, t.e.l.e.g.r.a.m)
  squeezed := regexp_replace(k, '[^a-z]', '', 'g');
  if squeezed ~ '(whatsapp|telegram|instagram|facebook|discord)' then return 'contato_rede'; end if;
  if k ~ '(me chama(r)? (no|la|pelo)|chama no pv|meu (numero|contato|cel|celular|telefone|fone|email|e-mail)|passa (seu|o seu|teu) (numero|contato|zap|email)|fora da plataforma|fora do app|fora do site|pagamento por fora|pagar por fora|fechar por fora|combinar por fora|negociar por fora)' then return 'contato_fora'; end if;
  -- linguagem ofensiva
  if k ~ '\m(porra|caralho|caralha|cacete|merda|bosta|puta|puto|putaria|fdp|filho da puta|filha da puta|vagabundo|vagabunda|arrombado|arrombada|cuzao|cuzona|otario|otaria|babaca|imbecil|idiota|retardado|retardada|desgracado|desgracada|vadia|viado|viadinho|buceta|piroca|foda-se|fodase|foder|vai se foder|vai tomar no cu|tomar no cu|vsf|vtnc|pqp|escroto|escrota|lixo humano|corno|corna)\M' then return 'ofensa'; end if;
  return null;
end $$;

create or replace function private.violation_message(p_code text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_code = 'ofensa' then 'Texto recusado: linguagem ofensiva não é permitida no Bico BR.'
    else 'Texto recusado: não é permitido divulgar telefone, e-mail, redes sociais ou aplicativos de mensagem. Combine tudo pelo chat do Bico BR.' end;
$$;

-- ---------------------------------------------------------------- ocorrências e suspensão
alter table public.profiles
  add column suspended_until timestamptz,
  add column suspension_reason text check (char_length(suspension_reason) <= 300),
  add column response_count integer not null default 0,
  add column response_seconds bigint not null default 0;

create table public.moderation_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  kind text not null,
  -- trecho original, visível só para a moderação
  excerpt text check (char_length(excerpt) <= 600),
  conversation_id uuid references public.conversations(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_flags_user_idx on public.moderation_flags (user_id, created_at desc);
create index moderation_flags_open_idx on public.moderation_flags (created_at) where reviewed_at is null;
alter table public.moderation_flags enable row level security;
grant all on public.moderation_flags to service_role;
grant select on public.moderation_flags to authenticated;
grant update (reviewed_by, reviewed_at) on public.moderation_flags to authenticated;
create policy moderation_flags_select on public.moderation_flags for select to authenticated using (private.has_admin_role('{moderation}'));
create policy moderation_flags_review on public.moderation_flags for update to authenticated
  using (private.has_admin_role('{moderation}')) with check (private.has_admin_role('{moderation}'));

create or replace function private.assert_not_suspended(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_until timestamptz;
begin
  select suspended_until into v_until from public.profiles where id = p_user;
  if v_until is not null and v_until > now() then
    raise exception 'Sua conta está suspensa até % por violação das regras de conduta. Fale com o suporte.', to_char(v_until at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
      using errcode = '42501', detail = 'ACCOUNT_SUSPENDED';
  end if;
end $$;

-- registra a ocorrência e suspende quem repete: 3 em 24 horas ou 5 em 30 dias => 7 dias de suspensão
create or replace function private.record_violation(p_user uuid, p_source text, p_kind text, p_excerpt text, p_conversation uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_day integer; v_month integer;
begin
  insert into public.moderation_flags (user_id, source, kind, excerpt, conversation_id)
  values (p_user, p_source, p_kind, left(p_excerpt, 600), p_conversation);
  select count(*) filter (where created_at > now() - interval '24 hours'), count(*)
    into v_day, v_month from public.moderation_flags
   where user_id = p_user and created_at > now() - interval '30 days';
  if v_day >= 3 or v_month >= 5 then
    update public.profiles
       set suspended_until = greatest(coalesce(suspended_until, now()), now() + interval '7 days'),
           suspension_reason = 'Suspensão automática: tentativas repetidas de contato por fora ou linguagem ofensiva'
     where id = p_user;
    insert into public.notifications (user_id, type, payload)
    values (p_user, 'account_suspended', jsonb_build_object('days', 7));
  end if;
end $$;
revoke all on function private.moderate_text(text), private.violation_message(text), private.assert_not_suspended(uuid),
  private.record_violation(uuid, text, text, text, uuid) from public, anon, authenticated;

-- moderação decide: p_days = 0 retira a suspensão
create or replace function public.set_user_suspension(p_user uuid, p_days integer, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_admin_role('{moderation}') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_days < 0 or p_days > 3650 or char_length(coalesce(btrim(p_reason), '')) < 10 then
    raise exception 'Informe o prazo e uma justificativa com pelo menos 10 caracteres' using errcode = 'P0001';
  end if;
  update public.profiles
     set suspended_until = case when p_days = 0 then null else now() + make_interval(days => p_days) end,
         suspension_reason = case when p_days = 0 then null else left(btrim(p_reason), 300) end
   where id = p_user;
  if not found then raise exception 'Usuário não encontrado' using errcode = 'P0002'; end if;
  update public.moderation_flags set reviewed_by = (select auth.uid()), reviewed_at = now()
   where user_id = p_user and reviewed_at is null;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, after)
  values ((select auth.uid()), 'moderation', case when p_days = 0 then 'unsuspend' else 'suspend' end, 'profiles', p_user::text,
          jsonb_build_object('days', p_days, 'reason', p_reason));
end $$;
revoke all on function public.set_user_suspension(uuid, integer, text) from public, anon;
grant execute on function public.set_user_suspension(uuid, integer, text) to authenticated, service_role;

-- ---------------------------------------------------------------- textos públicos: recusa na gravação
-- tg_argv = colunas de texto a conferir. Também barra contas suspensas de publicar.
create or replace function private.moderation_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := to_jsonb(new); v_col text; v_code text; v_uid uuid := (select auth.uid());
begin
  if v_uid is not null then perform private.assert_not_suspended(v_uid); end if;
  foreach v_col in array tg_argv loop
    if tg_op = 'INSERT' or (v_row ->> v_col) is distinct from (to_jsonb(old) ->> v_col) then
      v_code := private.moderate_text(v_row ->> v_col);
      if v_code is not null then
        raise exception '%', private.violation_message(v_code) using errcode = 'P0001', detail = 'MODERATION_' || upper(v_code);
      end if;
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.moderation_guard() from public, anon, authenticated;

create trigger moderate_profiles before insert or update on public.profiles for each row execute function private.moderation_guard('display_name');
create trigger moderate_freelancer before insert or update on public.freelancer_profiles for each row execute function private.moderation_guard('headline', 'bio');
create trigger moderate_companies before insert or update on public.companies for each row execute function private.moderation_guard('display_name', 'description');
create trigger moderate_projects before insert or update on public.projects for each row execute function private.moderation_guard('title', 'description', 'deliverables');
create trigger moderate_jobs before insert or update on public.jobs for each row execute function private.moderation_guard('title', 'description', 'requirements', 'benefits', 'selection_process');
create trigger moderate_proposals before insert or update on public.proposals for each row execute function private.moderation_guard('cover_letter', 'relevant_experience', 'extra_terms');
create trigger moderate_portfolio before insert or update on public.portfolio_items for each row execute function private.moderation_guard('title', 'description', 'results', 'link_url');
create trigger moderate_reviews before insert on public.reviews for each row execute function private.moderation_guard('comment');
create trigger moderate_deliverables before insert or update on public.contract_deliverables for each row execute function private.moderation_guard('delivery_note', 'review_note');
create trigger moderate_job_applications before insert on public.job_applications for each row execute function private.moderation_guard('cover_letter');
create trigger moderate_invites before insert on public.project_invites for each row execute function private.moderation_guard('message');

-- ---------------------------------------------------------------- chat: bloqueio, anexos e tempo de resposta
alter table public.messages add column blocked boolean not null default false;

create or replace function private.messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recent integer; v_code text; v_att jsonb; v_last record; v_prefix text;
begin
  perform private.assert_not_suspended(new.sender_id);
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

  -- anexos: só arquivos enviados pelo próprio remetente para a pasta desta conversa, de tipos permitidos
  v_prefix := new.conversation_id::text || '/' || new.sender_id::text || '/';
  for v_att in select * from jsonb_array_elements(new.attachments) loop
    if left(coalesce(v_att ->> 'path', ''), char_length(v_prefix)) <> v_prefix
       or substr(v_att ->> 'path', char_length(v_prefix) + 1) !~ '^[a-z0-9-]{8,60}\.(png|jpg|jpeg|webp|pdf|xlsx|xls|csv|docx|doc|pptx|txt)$'
       or char_length(coalesce(v_att ->> 'name', '')) not between 1 and 120
       or coalesce((v_att ->> 'size')::bigint, 0) not between 1 and 20971520 then
      raise exception 'Anexo inválido' using errcode = 'P0001', detail = 'ATTACHMENT_INVALID';
    end if;
    if private.moderate_text(v_att ->> 'name') is not null then
      raise exception 'O nome do arquivo contém contato ou termo não permitido. Renomeie e envie de novo.' using errcode = 'P0001';
    end if;
  end loop;

  -- conteúdo: a mensagem com contato/ofensa NÃO é entregue; o remetente é avisado e a ocorrência fica registrada
  v_code := private.moderate_text(new.body);
  if v_code is not null then
    perform private.record_violation(new.sender_id, 'message', v_code, new.body, new.conversation_id);
    new.body := private.violation_message(v_code);
    new.attachments := '[]';
    new.blocked := true;
    return new;
  end if;

  -- tempo de resposta: quanto demorou para responder a última mensagem da outra parte
  select sender_id, created_at into v_last from public.messages
   where conversation_id = new.conversation_id and not blocked order by id desc limit 1;
  if found and v_last.sender_id <> new.sender_id and v_last.created_at > now() - interval '7 days' then
    update public.profiles
       set response_count = response_count + 1,
           response_seconds = response_seconds + extract(epoch from (now() - v_last.created_at))::bigint
     where id = new.sender_id;
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;

-- mensagens bloqueadas só aparecem para quem tentou enviar
drop policy messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (private.is_participant(conversation_id) and (not blocked or sender_id = (select auth.uid())));

-- ---------------------------------------------------------------- vitrine: publicações e curtidas
alter table public.portfolio_items add column likes_count integer not null default 0;
create table public.post_likes (
  item_id uuid not null references public.portfolio_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
alter table public.post_likes enable row level security;
grant all on public.post_likes to service_role;
grant select, insert, delete on public.post_likes to authenticated;
create policy post_likes_select on public.post_likes for select to authenticated using (user_id = (select auth.uid()));
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.portfolio_items i where i.id = item_id and i.visibility = 'public' and i.user_id <> (select auth.uid())));
create policy post_likes_delete on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));
create trigger post_likes_cap before insert on public.post_likes for each row execute function private.cap_daily('user_id', '300');

create or replace function private.post_likes_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.portfolio_items set likes_count = greatest(likes_count + case when tg_op = 'INSERT' then 1 else -1 end, 0)
   where id = coalesce(new.item_id, old.item_id);
  return coalesce(new, old);
end $$;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function private.post_likes_count();
revoke all on function private.post_likes_count() from public, anon, authenticated;

-- imagem da publicação: só arquivo da pasta do próprio autor no bucket público do portfólio
create or replace function private.portfolio_media_guard()
returns trigger language plpgsql set search_path = '' as $$
declare m jsonb;
begin
  for m in select * from jsonb_array_elements(new.media) loop
    if coalesce(m ->> 'path', '') !~ ('^' || new.user_id::text || '/[a-z0-9-]{8,60}\.(png|jpg|jpeg|webp)$') then
      raise exception 'Imagem inválida' using errcode = 'P0001', detail = 'MEDIA_INVALID';
    end if;
  end loop;
  return new;
end $$;
create trigger portfolio_media_guard before insert or update of media on public.portfolio_items
  for each row execute function private.portfolio_media_guard();
revoke all on function private.portfolio_media_guard() from public, anon, authenticated;
-- likes_count não é editável pelo autor (o grant de UPDATE é por coluna e não o inclui)

-- ---------------------------------------------------------------- storage: tipos permitidos nos anexos do chat
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets set file_size_limit = 20971520, allowed_mime_types = array[
      'image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation']
     where id = 'chat-attachments';
    update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/png','image/jpeg','image/webp']
     where id = 'portfolio-public';
  end if;
end $$;
