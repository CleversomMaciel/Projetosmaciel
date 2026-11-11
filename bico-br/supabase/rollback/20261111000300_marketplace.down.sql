drop table if exists public.proposals, public.job_applications, public.job_skills, public.jobs,
  public.favorites, public.project_invites, public.project_skills, public.projects cascade;
drop function if exists private.owns_job(uuid);
drop function if exists private.has_proposal_on(uuid);
drop function if exists private.owns_project(uuid);
drop function if exists private.proposals_guard();
drop function if exists private.projects_set_published();
