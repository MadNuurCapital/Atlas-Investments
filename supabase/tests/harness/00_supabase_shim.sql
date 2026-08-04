-- =====================================================================
-- Supabase compatibility shim — TEST HARNESS ONLY
--
-- Supabase's hosted database provides an `auth` schema, the roles
-- `anon` / `authenticated` / `service_role`, and the helper functions
-- `auth.uid()` and `auth.role()`. A plain PostgreSQL instance does not.
--
-- This file recreates just enough of that environment to run the real
-- migrations and Row Level Security tests locally and in CI, without
-- needing Docker or a hosted project.
--
-- IT IS NEVER APPLIED TO A REAL DATABASE. It lives outside
-- supabase/migrations for exactly that reason.
-- =====================================================================

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- Minimal stand-in for auth.users. Only the columns the migrations touch.
create table if not exists auth.users (
  id                   uuid primary key default gen_random_uuid(),
  email                text unique not null,
  raw_user_meta_data   jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- Supabase derives these from the request's JWT. In tests we set the same
-- session settings by hand, which is exactly what Supabase's own testing
-- guidance recommends.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
