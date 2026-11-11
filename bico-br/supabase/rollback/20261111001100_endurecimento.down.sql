-- Remove limites e volta as funções de admin para a versão sem exigência de MFA.
-- ATENÇÃO: reverter esta migration REDUZ a segurança. Só em homologação.
drop trigger if exists portfolio_items_cap on public.portfolio_items;
drop trigger if exists portfolio_collections_cap on public.portfolio_collections;
drop trigger if exists favorites_cap on public.favorites;
drop trigger if exists user_blocks_cap on public.user_blocks;
drop trigger if exists freelancer_skills_cap on public.freelancer_skills;
drop trigger if exists reports_cap on public.reports;
drop trigger if exists dsr_cap on public.data_subject_requests;
drop trigger if exists projects_cap on public.projects;
drop trigger if exists jobs_cap on public.jobs;
drop trigger if exists job_applications_cap on public.job_applications;
drop function if exists private.cap_rows();
drop function if exists private.cap_daily();
do $$
declare c record;
begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
            where connamespace = 'public'::regnamespace and contype = 'c'
              and conname in ('fp_links_size','fp_languages_size','fp_experience_size','fp_education_size',
                'fp_certifications_size','fp_tools_size','fp_urls','profiles_avatar_len','pp_lengths',
                'companies_lengths','cp_lengths','proposals_links_size','proposals_amount_cap','pi_media_size',
                'pi_tools_size','pi_skills_size','pi_link_len','messages_attachments_size','ce_attachments_size',
                'ce_note_len','contracts_cancel_reason_len','ja_resume_len','reports_target_len','de_file_len',
                'refunds_reason_len','consents_lengths')
  loop execute format('alter table %s drop constraint %I', c.tbl, c.conname); end loop;
end $$;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_members m where m.user_id = (select auth.uid()));
$$;
create or replace function private.has_admin_role(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_members m where m.user_id = (select auth.uid())
                  and (m.role = 'super_admin' or m.role = any (p_roles)));
$$;
