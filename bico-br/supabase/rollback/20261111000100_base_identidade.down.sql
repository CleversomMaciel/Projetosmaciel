drop trigger if exists on_auth_user_created on auth.users;
drop function if exists private.handle_new_user();
drop table if exists public.company_private, public.companies, public.freelancer_profiles,
  public.profile_private, public.profiles, public.admin_members cascade;
drop function if exists private.owns_company(uuid);
drop function if exists private.has_admin_role(text[]);
drop function if exists private.is_admin();
drop function if exists private.set_updated_at();
drop schema if exists private;
