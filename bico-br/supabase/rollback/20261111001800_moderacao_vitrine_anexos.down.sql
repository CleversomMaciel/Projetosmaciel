-- ATENÇÃO: reverter remove o filtro de conduta e as suspensões. Só em homologação.
drop trigger if exists portfolio_media_guard on public.portfolio_items;
drop function if exists private.portfolio_media_guard();
drop table if exists public.post_likes cascade;
drop function if exists private.post_likes_count();
alter table public.portfolio_items drop column if exists likes_count;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (private.is_participant(conversation_id));
do $$ declare t record; begin
  for t in select tgname, tgrelid::regclass as tbl from pg_trigger where tgname like 'moderate\_%' and not tgisinternal loop
    execute format('drop trigger %I on %s', t.tgname, t.tbl);
  end loop;
end $$;
-- messages_guard volta à versão sem moderação
create or replace function private.messages_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recent integer;
begin
  select count(*) into v_recent from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_recent >= 30 then raise exception 'Limite de mensagens por minuto atingido' using errcode = 'P0001'; end if;
  if exists (select 1 from public.conversation_participants p join public.user_blocks b on b.blocker_id = p.user_id and b.blocked_id = new.sender_id
              where p.conversation_id = new.conversation_id) then
    raise exception 'Não é possível enviar mensagens nesta conversa' using errcode = '42501';
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;
alter table public.messages drop column if exists blocked;
drop function if exists public.set_user_suspension(uuid, integer, text);
drop function if exists private.moderation_guard();
drop function if exists private.record_violation(uuid, text, text, text, uuid);
drop function if exists private.assert_not_suspended(uuid);
drop table if exists public.moderation_flags cascade;
drop function if exists private.violation_message(text);
drop function if exists private.moderate_text(text);
alter table public.profiles drop column if exists suspended_until, drop column if exists suspension_reason,
  drop column if exists response_count, drop column if exists response_seconds;
