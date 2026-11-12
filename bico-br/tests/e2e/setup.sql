-- SOMENTE para o ambiente de teste local. Nunca aplicar em um projeto real.
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
create schema e2e;
create table e2e.passwords (user_id uuid primary key, email text unique, password text);

create function public.e2e_signup(p_email text, p_password text, p_meta jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into auth.users (email, raw_user_meta_data) values (p_email, coalesce(p_meta, '{}')) returning id into v_id;
  insert into e2e.passwords values (v_id, p_email, p_password);
  return v_id;
end $$;
create function public.e2e_login(p_email text, p_password text) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('id', u.id, 'email', u.email, 'meta', u.raw_user_meta_data,
           'admin', exists (select 1 from public.admin_members m where m.user_id = u.id))
    from e2e.passwords p join auth.users u on u.id = p.user_id
   where p.email = p_email and p.password = p_password;
$$;
create function public.e2e_user(p_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('id', u.id, 'email', u.email, 'meta', u.raw_user_meta_data,
           'admin', exists (select 1 from public.admin_members m where m.user_id = u.id))
    from auth.users u where u.id = p_id;
$$;
create function public.e2e_make_admin(p_email text, p_role text) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_members (user_id, role) select id, p_role from auth.users where email = p_email;
$$;
revoke all on function public.e2e_signup(text, text, jsonb), public.e2e_login(text, text),
  public.e2e_user(uuid), public.e2e_make_admin(text, text) from public, anon, authenticated;
grant execute on function public.e2e_signup(text, text, jsonb), public.e2e_login(text, text),
  public.e2e_user(uuid), public.e2e_make_admin(text, text) to service_role;
