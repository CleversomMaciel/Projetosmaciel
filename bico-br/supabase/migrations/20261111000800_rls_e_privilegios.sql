-- Bico BR — 0008: privilégios explícitos + RLS em todas as tabelas.
-- Princípio: nada é concedido por padrão. Cada tabela recebe apenas o que precisa.
-- ATENÇÃO: toda tabela nova em migrations futuras precisa de RLS + grants explícitos.

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- RPCs disponíveis para usuários autenticados
grant execute on function
  public.submit_proposal(uuid, bigint, integer, text, text, jsonb, text),
  public.request_pro(text, boolean),
  public.cancel_pro(),
  public.accept_proposal(uuid),
  public.confirm_contract(uuid),
  public.deliver_contract(uuid, text, jsonb),
  public.request_changes(uuid, text),
  public.approve_delivery(uuid),
  public.cancel_contract(uuid, text),
  public.open_dispute(uuid, text, text),
  public.start_project_conversation(uuid, uuid)
to authenticated;
-- process_payment_update e expire_subscriptions: somente service_role (grant acima)

-- ================================================================ identidade
grant select on public.admin_members to authenticated;
create policy admin_members_select on public.admin_members for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{}'));

grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url, city, uf, onboarded_at) on public.profiles to authenticated;
create policy profiles_select_auth on public.profiles for select to authenticated using (true);
create policy profiles_select_anon on public.profiles for select to anon
  using (exists (select 1 from public.freelancer_profiles f where f.user_id = id and f.is_public));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.profile_private to authenticated;
grant update (full_name, cpf, phone, birth_date, cep, street, number, complement, district,
              city, uf, ibge_code, address_confirmed_at) on public.profile_private to authenticated;
create policy profile_private_select on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{support}'));
create policy profile_private_update on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.freelancer_profiles to anon, authenticated;
grant update (slug, headline, bio, cover_url, availability, hourly_rate_cents, links, languages,
              tools, experience, education, certifications, is_public)
  on public.freelancer_profiles to authenticated;
create policy freelancer_profiles_select_anon on public.freelancer_profiles for select to anon
  using (is_public);
create policy freelancer_profiles_select_auth on public.freelancer_profiles for select to authenticated
  using (true);
create policy freelancer_profiles_update on public.freelancer_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- empresas: criação somente pelo backend (dados cadastrais validados no servidor)
grant select on public.companies to anon, authenticated;
grant update (display_name, logo_url, description, segment, website, city, uf, is_public)
  on public.companies to authenticated;
create policy companies_select_anon on public.companies for select to anon using (is_public);
create policy companies_select_auth on public.companies for select to authenticated
  using (is_public or owner_id = (select auth.uid()) or private.is_admin());
create policy companies_update on public.companies for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select on public.company_private to authenticated;
grant update (cep, street, number, complement, district, city, uf, ibge_code,
              contact_phone, contact_email, address_confirmed_at)
  on public.company_private to authenticated;
create policy company_private_select on public.company_private for select to authenticated
  using (private.owns_company(company_id) or private.has_admin_role('{support,finance}'));
create policy company_private_update on public.company_private for update to authenticated
  using (private.owns_company(company_id)) with check (private.owns_company(company_id));

-- ================================================================ catálogo
grant select on public.categories, public.subcategories, public.skills, public.category_skills
  to anon, authenticated;
grant insert, update, delete on public.categories, public.subcategories, public.skills,
  public.category_skills to authenticated;
create policy categories_select on public.categories for select to anon, authenticated
  using (is_active or private.has_admin_role('{content}'));
create policy categories_admin on public.categories for all to authenticated
  using (private.has_admin_role('{content}')) with check (private.has_admin_role('{content}'));
create policy subcategories_select on public.subcategories for select to anon, authenticated
  using (is_active or private.has_admin_role('{content}'));
create policy subcategories_admin on public.subcategories for all to authenticated
  using (private.has_admin_role('{content}')) with check (private.has_admin_role('{content}'));
create policy skills_select on public.skills for select to anon, authenticated
  using (is_active or private.has_admin_role('{content}'));
create policy skills_admin on public.skills for all to authenticated
  using (private.has_admin_role('{content}')) with check (private.has_admin_role('{content}'));
create policy category_skills_select on public.category_skills for select to anon, authenticated using (true);
create policy category_skills_admin on public.category_skills for all to authenticated
  using (private.has_admin_role('{content}')) with check (private.has_admin_role('{content}'));

grant select on public.freelancer_skills, public.freelancer_categories to anon, authenticated;
grant insert, delete on public.freelancer_skills, public.freelancer_categories to authenticated;
create policy freelancer_skills_select on public.freelancer_skills for select to anon, authenticated using (true);
create policy freelancer_skills_insert on public.freelancer_skills for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy freelancer_skills_delete on public.freelancer_skills for delete to authenticated
  using (user_id = (select auth.uid()));
create policy freelancer_categories_select on public.freelancer_categories for select to anon, authenticated using (true);
create policy freelancer_categories_insert on public.freelancer_categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy freelancer_categories_delete on public.freelancer_categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- ================================================================ projetos
grant select on public.projects to anon, authenticated;
grant insert (id, company_id, created_by, kind, title, description, category_id, subcategory_id,
              budget_type, budget_min_cents, budget_max_cents, deadline_days, deliverables,
              hiring_mode, experience_level, professionals_wanted, status, is_public)
  on public.projects to authenticated;
grant update (title, description, category_id, subcategory_id, budget_type, budget_min_cents,
              budget_max_cents, deadline_days, deliverables, hiring_mode, experience_level,
              professionals_wanted, status, is_public)
  on public.projects to authenticated;
create policy projects_select_anon on public.projects for select to anon
  using (is_public and status in ('open','in_progress','completed'));
create policy projects_select_auth on public.projects for select to authenticated
  using ((is_public and status in ('open','in_progress','completed'))
         or private.owns_company(company_id) or private.is_admin()
         or private.has_proposal_on(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (private.owns_company(company_id) and created_by = (select auth.uid())
              and status in ('draft','open'));
create policy projects_update on public.projects for update to authenticated
  using (private.owns_company(company_id) and status in ('draft','open'))
  with check (private.owns_company(company_id) and status in ('draft','open','closed','cancelled'));

grant select on public.project_skills to anon, authenticated;
grant insert, delete on public.project_skills to authenticated;
create policy project_skills_select on public.project_skills for select to anon, authenticated using (true);
create policy project_skills_insert on public.project_skills for insert to authenticated
  with check (private.owns_project(project_id));
create policy project_skills_delete on public.project_skills for delete to authenticated
  using (private.owns_project(project_id));

grant select, insert, delete on public.project_invites to authenticated;
create policy project_invites_select on public.project_invites for select to authenticated
  using (freelancer_id = (select auth.uid()) or invited_by = (select auth.uid()));
create policy project_invites_insert on public.project_invites for insert to authenticated
  with check (invited_by = (select auth.uid())
              and private.owns_project(project_id));
create policy project_invites_delete on public.project_invites for delete to authenticated
  using (invited_by = (select auth.uid()));

grant select, insert, delete on public.favorites to authenticated;
create policy favorites_all on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ================================================================ vagas
grant select on public.jobs to anon, authenticated;
grant insert (company_id, created_by, title, description, category_id, requirements, contract_type,
              salary_min_cents, salary_max_cents, workload, benefits, experience_level,
              company_city, company_uf, application_deadline, selection_process, apply_mode,
              apply_url, status)
  on public.jobs to authenticated;
grant update (title, description, category_id, requirements, contract_type,
              salary_min_cents, salary_max_cents, workload, benefits, experience_level,
              company_city, company_uf, application_deadline, selection_process, apply_mode,
              apply_url, status)
  on public.jobs to authenticated;
create policy jobs_select_anon on public.jobs for select to anon using (status = 'open');
create policy jobs_select_auth on public.jobs for select to authenticated
  using (status = 'open' or private.owns_company(company_id) or private.is_admin());
create policy jobs_insert on public.jobs for insert to authenticated
  with check (private.owns_company(company_id) and created_by = (select auth.uid()));
create policy jobs_update on public.jobs for update to authenticated
  using (private.owns_company(company_id)) with check (private.owns_company(company_id));

grant select on public.job_skills to anon, authenticated;
grant insert, delete on public.job_skills to authenticated;
create policy job_skills_select on public.job_skills for select to anon, authenticated using (true);
create policy job_skills_insert on public.job_skills for insert to authenticated
  with check (private.owns_job(job_id));
create policy job_skills_delete on public.job_skills for delete to authenticated
  using (private.owns_job(job_id));

grant select on public.job_applications to authenticated;
grant insert (job_id, candidate_id, cover_letter, resume_path) on public.job_applications to authenticated;
grant update (status) on public.job_applications to authenticated;
create policy job_applications_select on public.job_applications for select to authenticated
  using (candidate_id = (select auth.uid())
         or private.owns_job(job_id));
create policy job_applications_insert on public.job_applications for insert to authenticated
  with check (candidate_id = (select auth.uid())
              and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open'
                           and j.apply_mode = 'internal' and not private.owns_company(j.company_id)));
create policy job_applications_update_candidate on public.job_applications for update to authenticated
  using (candidate_id = (select auth.uid()))
  with check (candidate_id = (select auth.uid()) and status = 'withdrawn');
create policy job_applications_update_company on public.job_applications for update to authenticated
  using (private.owns_job(job_id))
  with check (status in ('in_review','interview','rejected','hired'));

-- ================================================================ propostas
grant select on public.proposals to authenticated;
grant update (amount_cents, deadline_days, cover_letter, relevant_experience, portfolio_links,
              extra_terms, status) on public.proposals to authenticated;
create policy proposals_select on public.proposals for select to authenticated
  using (freelancer_id = (select auth.uid()) or private.is_admin()
         or private.owns_project(project_id));
create policy proposals_update_author on public.proposals for update to authenticated
  using (freelancer_id = (select auth.uid()) and status = 'sent')
  with check (freelancer_id = (select auth.uid()) and status in ('sent','withdrawn'));
create policy proposals_update_company on public.proposals for update to authenticated
  using (status in ('sent','shortlisted')
         and private.owns_project(project_id))
  with check (status in ('shortlisted','rejected'));

-- ================================================================ assinatura / financeiro
grant select on public.platform_settings to anon, authenticated;
grant insert, update on public.platform_settings to authenticated;
create policy platform_settings_select on public.platform_settings for select to anon, authenticated
  using (is_public or private.has_admin_role('{finance}'));
create policy platform_settings_admin_ins on public.platform_settings for insert to authenticated
  with check (private.has_admin_role('{finance}'));
create policy platform_settings_admin_upd on public.platform_settings for update to authenticated
  using (private.has_admin_role('{finance}')) with check (private.has_admin_role('{finance}'));

grant select on public.plans to anon, authenticated;
grant insert, update on public.plans to authenticated;
create policy plans_select on public.plans for select to anon, authenticated
  using (is_active or private.has_admin_role('{finance}'));
create policy plans_admin_ins on public.plans for insert to authenticated
  with check (private.has_admin_role('{finance}'));
create policy plans_admin_upd on public.plans for update to authenticated
  using (private.has_admin_role('{finance}')) with check (private.has_admin_role('{finance}'));

grant select on public.freelancer_billing, public.subscription_events to authenticated;
create policy freelancer_billing_select on public.freelancer_billing for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{finance,support}'));
create policy subscription_events_select on public.subscription_events for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{finance,support}'));

grant select on public.contracts, public.contract_events, public.payments to authenticated;
create policy contracts_select on public.contracts for select to authenticated
  using ((select auth.uid()) in (freelancer_id, company_user_id)
         or private.has_admin_role('{finance,support}'));
create policy contract_events_select on public.contract_events for select to authenticated
  using (private.is_contract_party(contract_id) or private.has_admin_role('{finance,support}'));
create policy payments_select on public.payments for select to authenticated
  using (payer_id = (select auth.uid())
         or (contract_id is not null and private.is_contract_party(contract_id))
         or private.has_admin_role('{finance}'));

grant select on public.refunds to authenticated;
grant insert (payment_id, amount_cents, reason, requested_by) on public.refunds to authenticated;
grant update (status, decided_by, decided_at, decision_note) on public.refunds to authenticated;
create policy refunds_select on public.refunds for select to authenticated
  using (requested_by = (select auth.uid()) or private.has_admin_role('{finance}'));
create policy refunds_insert on public.refunds for insert to authenticated
  with check (requested_by = (select auth.uid())
              and exists (select 1 from public.payments p
                           where p.id = payment_id and p.payer_id = (select auth.uid())
                             and p.status = 'approved' and amount_cents <= p.amount_cents));
create policy refunds_decide on public.refunds for update to authenticated
  using (private.has_admin_role('{finance}') and status = 'requested')
  with check (private.has_admin_role('{finance}') and status in ('approved','denied')
              and decided_by = (select auth.uid()));

grant select on public.disputes, public.dispute_entries to authenticated;
grant update (status, resolution, resolved_by, resolved_at) on public.disputes to authenticated;
grant insert (dispute_id, author_id, body, file_path) on public.dispute_entries to authenticated;
create policy disputes_select on public.disputes for select to authenticated
  using (private.is_contract_party(contract_id) or private.has_admin_role('{support,finance,moderation}'));
create policy disputes_admin_update on public.disputes for update to authenticated
  using (private.has_admin_role('{support}')) with check (private.has_admin_role('{support}'));
create policy dispute_entries_select on public.dispute_entries for select to authenticated
  using (exists (select 1 from public.disputes d where d.id = dispute_id
                  and (private.is_contract_party(d.contract_id)
                       or private.has_admin_role('{support,finance,moderation}'))));
create policy dispute_entries_insert on public.dispute_entries for insert to authenticated
  with check (author_id = (select auth.uid())
              and exists (select 1 from public.disputes d where d.id = dispute_id
                           and d.status not in ('resolved','closed')
                           and (private.is_contract_party(d.contract_id)
                                or private.has_admin_role('{support}'))));

-- ================================================================ portfólio / reputação
grant select on public.portfolio_collections, public.portfolio_items, public.reviews to anon, authenticated;
grant insert, update, delete on public.portfolio_collections to authenticated;
grant insert (user_id, collection_id, title, description, results, media, link_url, tools,
              category_id, skill_ids, origin, contract_id, visibility, is_featured, sort_order),
      update (collection_id, title, description, results, media, link_url, tools,
              category_id, skill_ids, origin, contract_id, visibility, is_featured, sort_order),
      delete on public.portfolio_items to authenticated;
create policy portfolio_collections_select on public.portfolio_collections for select to anon, authenticated using (true);
create policy portfolio_collections_write on public.portfolio_collections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy portfolio_items_select_anon on public.portfolio_items for select to anon
  using (visibility = 'public'
         and exists (select 1 from public.freelancer_profiles f where f.user_id = portfolio_items.user_id and f.is_public));
create policy portfolio_items_select_auth on public.portfolio_items for select to authenticated
  using (visibility = 'public' or user_id = (select auth.uid()));
-- selo "feito no Bico BR" só com contrato concluído do próprio freelancer
create policy portfolio_items_insert on public.portfolio_items for insert to authenticated
  with check (user_id = (select auth.uid())
              and (origin = 'external'
                   or exists (select 1 from public.contracts c where c.id = contract_id
                               and c.freelancer_id = (select auth.uid()) and c.status = 'completed')));
create policy portfolio_items_update on public.portfolio_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and (origin = 'external'
                   or exists (select 1 from public.contracts c where c.id = contract_id
                               and c.freelancer_id = (select auth.uid()) and c.status = 'completed')));
create policy portfolio_items_delete on public.portfolio_items for delete to authenticated
  using (user_id = (select auth.uid()));

grant insert (contract_id, reviewer_id, rating, comment) on public.reviews to authenticated;
create policy reviews_select on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (reviewer_id = (select auth.uid()));

-- ================================================================ chat
grant select on public.conversations, public.conversation_participants, public.messages to authenticated;
grant update (last_read_at) on public.conversation_participants to authenticated;
grant insert (conversation_id, sender_id, body, attachments) on public.messages to authenticated;
create policy conversations_select on public.conversations for select to authenticated
  using (private.is_participant(id));
create policy conversation_participants_select on public.conversation_participants for select to authenticated
  using (private.is_participant(conversation_id));
create policy conversation_participants_update on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_select on public.messages for select to authenticated
  using (private.is_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_participant(conversation_id));

grant select, insert, delete on public.user_blocks to authenticated;
create policy user_blocks_all on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;
grant update (status, handled_by, handled_at, resolution_note) on public.reports to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.has_admin_role('{moderation,support}'));
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_admin_update on public.reports for update to authenticated
  using (private.has_admin_role('{moderation}')) with check (private.has_admin_role('{moderation}'));

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ================================================================ conformidade
grant select on public.legal_documents to anon, authenticated;
create policy legal_documents_select on public.legal_documents for select to anon, authenticated
  using (published_at is not null and published_at <= now());

grant select on public.consents to authenticated;
grant insert (user_id, doc_type, doc_version, user_agent) on public.consents to authenticated;
create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{support}'));
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select on public.data_subject_requests to authenticated;
grant insert (user_id, type, details) on public.data_subject_requests to authenticated;
grant update (status, response, handled_by, resolved_at) on public.data_subject_requests to authenticated;
create policy dsr_select on public.data_subject_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.has_admin_role('{support}'));
create policy dsr_insert on public.data_subject_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy dsr_admin_update on public.data_subject_requests for update to authenticated
  using (private.has_admin_role('{support}')) with check (private.has_admin_role('{support}'));

grant select on public.audit_logs, public.external_api_logs to authenticated;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.has_admin_role('{finance}'));
create policy external_api_logs_select on public.external_api_logs for select to authenticated
  using (private.has_admin_role('{support}'));

grant select on public.referral_codes, public.referrals to authenticated;
create policy referral_codes_select on public.referral_codes for select to authenticated
  using (user_id = (select auth.uid()));
create policy referrals_select on public.referrals for select to authenticated
  using ((select auth.uid()) in (referrer_id, referred_id) or private.has_admin_role('{finance}'));

-- webhook_events e registry_cache: sem políticas e sem grants => acesso só pelo service_role.
