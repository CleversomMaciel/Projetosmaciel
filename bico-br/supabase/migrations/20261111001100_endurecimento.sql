-- Bico BR — 0011: endurecimento de segurança
-- 1) funções internas deixam de ser executáveis pelos papéis de API
-- 2) ações administrativas exigem sessão com segundo fator (MFA / aal2)
-- 3) limites de tamanho em campos livres (JSON e texto) contra abuso de armazenamento
-- 4) corrida na criação de conversas

-- ---------------------------------------------------------------- 1) privilégios do schema private
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
-- somente os auxiliares usados dentro de políticas RLS (rodam com o papel do usuário)
grant execute on function
  private.is_admin(), private.has_admin_role(text[]), private.owns_company(uuid),
  private.owns_project(uuid), private.has_proposal_on(uuid), private.owns_job(uuid),
  private.is_contract_party(uuid), private.is_participant(uuid)
to anon, authenticated;

-- ---------------------------------------------------------------- 2) admin exige MFA
-- O token do Supabase traz "aal": aal1 = só senha; aal2 = senha + segundo fator verificado.
-- Uma senha de administrador vazada, sozinha, não dá acesso administrativo.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.admin_members m where m.user_id = (select auth.uid()));
$$;

create or replace function private.has_admin_role(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.admin_members m
        where m.user_id = (select auth.uid())
          and (m.role = 'super_admin' or m.role = any (p_roles)));
$$;

-- o próprio administrador enxerga seu vínculo mesmo sem MFA (a tela precisa saber que deve pedir o 2º fator)
drop policy admin_members_select on public.admin_members;
create policy admin_members_select on public.admin_members for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{}'));

-- ---------------------------------------------------------------- 3) limites de tamanho
alter table public.freelancer_profiles
  add constraint fp_links_size check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10 and pg_column_size(links) <= 4096),
  add constraint fp_languages_size check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) <= 15 and pg_column_size(languages) <= 4096),
  add constraint fp_experience_size check (jsonb_typeof(experience) = 'array' and jsonb_array_length(experience) <= 30 and pg_column_size(experience) <= 32768),
  add constraint fp_education_size check (jsonb_typeof(education) = 'array' and jsonb_array_length(education) <= 20 and pg_column_size(education) <= 16384),
  add constraint fp_certifications_size check (jsonb_typeof(certifications) = 'array' and jsonb_array_length(certifications) <= 30 and pg_column_size(certifications) <= 16384),
  add constraint fp_tools_size check (coalesce(array_length(tools, 1), 0) <= 40 and pg_column_size(tools) <= 4096),
  add constraint fp_urls check (char_length(cover_url) <= 500);
alter table public.profiles add constraint profiles_avatar_len check (char_length(avatar_url) <= 500);
alter table public.profile_private
  add constraint pp_lengths check (char_length(street) <= 200 and char_length(number) <= 20 and char_length(complement) <= 120
                                   and char_length(district) <= 120 and char_length(city) <= 120);
alter table public.companies
  add constraint companies_lengths check (char_length(city) <= 120 and char_length(logo_url) <= 500 and char_length(website) <= 300);
alter table public.company_private
  add constraint cp_lengths check (char_length(street) <= 200 and char_length(number) <= 20 and char_length(complement) <= 120
                                   and char_length(district) <= 120 and char_length(city) <= 120
                                   and char_length(contact_phone) <= 20 and char_length(contact_email) <= 200);
alter table public.proposals
  add constraint proposals_links_size check (jsonb_typeof(portfolio_links) = 'array' and jsonb_array_length(portfolio_links) <= 10 and pg_column_size(portfolio_links) <= 4096),
  add constraint proposals_amount_cap check (amount_cents <= 100000000000);
alter table public.portfolio_items
  add constraint pi_media_size check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 12 and pg_column_size(media) <= 8192),
  add constraint pi_tools_size check (coalesce(array_length(tools, 1), 0) <= 30 and pg_column_size(tools) <= 2048),
  add constraint pi_skills_size check (coalesce(array_length(skill_ids, 1), 0) <= 20),
  add constraint pi_link_len check (char_length(link_url) <= 500);
alter table public.messages
  add constraint messages_attachments_size check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5 and pg_column_size(attachments) <= 4096);
alter table public.contract_events
  add constraint ce_attachments_size check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 20 and pg_column_size(attachments) <= 8192),
  add constraint ce_note_len check (char_length(note) <= 5000);
alter table public.contracts add constraint contracts_cancel_reason_len check (char_length(cancel_reason) <= 2000);
alter table public.job_applications add constraint ja_resume_len check (char_length(resume_path) <= 500);
alter table public.reports add constraint reports_target_len check (char_length(target_id) <= 80);
alter table public.dispute_entries add constraint de_file_len check (char_length(file_path) <= 500);
alter table public.refunds add constraint refunds_reason_len check (char_length(reason) between 10 and 2000);
alter table public.consents add constraint consents_lengths check (char_length(doc_type) <= 60 and char_length(doc_version) <= 40 and char_length(user_agent) <= 300);

-- limites de quantidade por usuário (evita encher o banco por script)
create or replace function private.cap_rows()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count bigint; v_max integer := tg_argv[1]::integer;
begin
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, tg_argv[0])
    into v_count using (to_jsonb(new) ->> tg_argv[0])::uuid;
  if v_count >= v_max then
    raise exception 'Limite de % registros atingido', v_max using errcode = 'P0001', detail = 'ROW_CAP';
  end if;
  return new;
end $$;
create trigger portfolio_items_cap before insert on public.portfolio_items
  for each row execute function private.cap_rows('user_id', '200');
create trigger portfolio_collections_cap before insert on public.portfolio_collections
  for each row execute function private.cap_rows('user_id', '30');
create trigger favorites_cap before insert on public.favorites
  for each row execute function private.cap_rows('user_id', '500');
create trigger user_blocks_cap before insert on public.user_blocks
  for each row execute function private.cap_rows('blocker_id', '500');
create trigger freelancer_skills_cap before insert on public.freelancer_skills
  for each row execute function private.cap_rows('user_id', '40');

-- denúncias e solicitações LGPD: no máximo 20 por usuário a cada 24h
create or replace function private.cap_daily()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count bigint;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - interval ''24 hours''',
                 tg_table_name, tg_argv[0])
    into v_count using (to_jsonb(new) ->> tg_argv[0])::uuid;
  if v_count >= tg_argv[1]::integer then
    raise exception 'Limite diário atingido. Tente novamente amanhã.' using errcode = 'P0001', detail = 'DAILY_CAP';
  end if;
  return new;
end $$;
create trigger reports_cap before insert on public.reports
  for each row execute function private.cap_daily('reporter_id', '20');
create trigger dsr_cap before insert on public.data_subject_requests
  for each row execute function private.cap_daily('user_id', '5');
create trigger projects_cap before insert on public.projects
  for each row execute function private.cap_daily('created_by', '30');
create trigger jobs_cap before insert on public.jobs
  for each row execute function private.cap_daily('created_by', '30');
create trigger job_applications_cap before insert on public.job_applications
  for each row execute function private.cap_daily('candidate_id', '60');

-- ---------------------------------------------------------------- 4) conversa: sem duplicata em corrida
create or replace function public.start_project_conversation(p_project_id uuid, p_freelancer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_project public.projects;
  v_owner uuid;
  v_conv uuid;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Projeto não encontrado' using errcode = 'P0002'; end if;
  select owner_id into v_owner from public.companies where id = v_project.company_id;
  if v_uid is null or v_uid not in (v_owner, p_freelancer_id) or v_owner = p_freelancer_id then
    raise exception 'Sem permissão para esta conversa' using errcode = '42501';
  end if;
  if not exists (select 1 from public.proposals where project_id = p_project_id and freelancer_id = p_freelancer_id)
     and not exists (select 1 from public.project_invites where project_id = p_project_id and freelancer_id = p_freelancer_id) then
    raise exception 'É necessário haver proposta ou convite para iniciar a conversa' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_blocks
              where (blocker_id, blocked_id) in ((v_owner, p_freelancer_id), (p_freelancer_id, v_owner))) then
    raise exception 'Conversa indisponível' using errcode = '42501';
  end if;

  -- serializa a criação para o par (projeto, freelancer)
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || p_freelancer_id::text, 0));
  select c.id into v_conv from public.conversations c
   where c.project_id = p_project_id
     and exists (select 1 from public.conversation_participants p
                  where p.conversation_id = c.id and p.user_id = p_freelancer_id)
   limit 1;
  if v_conv is null then
    insert into public.conversations (context_type, project_id, created_by)
    values ('project', p_project_id, v_uid) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conv, v_owner), (v_conv, p_freelancer_id);
  end if;
  return v_conv;
end $$;
revoke all on function public.start_project_conversation(uuid, uuid) from public, anon;
grant execute on function public.start_project_conversation(uuid, uuid) to authenticated, service_role;
