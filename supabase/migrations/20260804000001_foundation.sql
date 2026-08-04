-- =====================================================================
-- Atlas Investments — 0001 Foundation
-- Roles, profiles, Row Level Security helpers.
--
-- The security model in one sentence: you can see your own clients and
-- nobody else's, whatever your role. This migration builds the machinery
-- that later migrations lean on to enforce that in the database itself,
-- not merely in the interface.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------

create type public.app_role as enum ('advisor', 'manager', 'admin');

comment on type public.app_role is
  'Atlas Investments V1 ships with advisor and admin only. The manager value '
  'is reserved so the role can be introduced later without a type migration; '
  'nothing in the application assigns it.';

create type public.theme_preference as enum ('light', 'dark', 'system');

-- ---------------------------------------------------------------------
-- profiles
--
-- One row per authenticated user. Deliberately separate from auth.users:
-- application data does not belong in the auth schema, and RLS policies
-- need a table they can join against.
-- ---------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text not null default '',
  role              public.app_role not null default 'advisor',
  is_active         boolean not null default true,
  theme_preference  public.theme_preference not null default 'system',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each auth user. Role and active status are '
  'controlled by administrators only and are protected by a trigger.';

comment on column public.profiles.is_active is
  'Deactivated users keep their history but cannot sign in or read any data. '
  'Every RLS policy in this database checks this flag.';

create index profiles_role_idx on public.profiles (role) where is_active;

-- ---------------------------------------------------------------------
-- Helper functions
--
-- All are SECURITY DEFINER with an empty search_path. Two reasons:
--
--   1. Recursion. A policy on `profiles` that queried `profiles` through a
--      normal function would re-trigger the same policy forever. SECURITY
--      DEFINER runs the function as its owner and skips RLS, breaking
--      the loop.
--   2. Injection. Pinning search_path to '' means every object must be
--      schema-qualified, so a malicious object planted in another schema
--      cannot shadow the ones referenced here.
-- ---------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_active_user() is
  'True only for a signed-in user whose profile exists and is active. '
  'Every table policy begins with this check.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active and p.role = 'admin'
       from public.profiles p
      where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_admin() is
  'Administrative privilege covers users, funds, imports and settings. '
  'It grants NO access to another user''s client records anywhere in this '
  'database. That is intentional and must not be changed without an '
  'explicit written decision from the firm.';

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Generic updated_at maintenance, reused by later migrations.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Protecting role and active status
--
-- Without this, an advisor could call the ordinary "update my profile"
-- endpoint with role = 'admin' and promote themselves. RLS alone cannot
-- express "you may update this row but not these two columns", so a
-- trigger enforces it.
-- ---------------------------------------------------------------------

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server-side administration (invites, activation, seeding) runs with the
  -- service role and is trusted; those code paths do their own authorisation.
  if auth.role() = 'service_role' then
    new.updated_at := now();
    return new;
  end if;

  if (new.role is distinct from old.role)
     or (new.is_active is distinct from old.is_active) then

    if not public.is_admin() then
      raise exception 'Only an administrator may change a role or active status'
        using errcode = '42501';
    end if;

    -- An admin who demotes or deactivates themselves locks everyone out of
    -- user management with no way back through the application.
    if new.id = (select auth.uid()) then
      raise exception 'You cannot change your own role or active status'
        using errcode = '42501';
    end if;
  end if;

  -- Identity columns are immutable from the application's point of view.
  new.id         := old.id;
  new.email      := old.email;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- Provisioning
--
-- Accounts are invite-only: there is no public sign-up. An administrator
-- invites by email, Supabase creates the auth user, and this trigger
-- mirrors it into profiles. Role travels in the invite metadata, which
-- only a server-side admin action can set.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'advisor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Row Level Security on profiles
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Read your own profile. Needed on every page to resolve role and theme.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Admins read every profile, for the user management screen. Profiles hold
-- no client data, so this is not a route into anyone's client book.
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Update your own profile. The trigger above restricts this to display name
-- and theme in practice.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and public.is_active_user())
  with check (id = (select auth.uid()));

create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT or DELETE policy exists. Profiles are created by the auth trigger
-- and are never deleted from the application — deactivate instead, so history
-- and ownership records stay intact.
revoke insert, delete on public.profiles from authenticated, anon;
