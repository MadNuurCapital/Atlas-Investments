-- =====================================================================
-- Atlas Investments — 0005 Make the first administrator possible
--
-- Fixes a bootstrap deadlock shipped in 0001.
--
-- `protect_profile_fields()` refuses any change to `role` or `is_active`
-- unless `public.is_admin()` returns true, with a single exemption for
-- `auth.role() = 'service_role'`. That exemption covers the application's
-- own server actions, which do carry a service-role JWT.
--
-- It does not cover the SQL editor. A statement run there carries no JWT at
-- all, so `auth.role()` is NULL, the exemption never fires, and the check
-- falls through to `is_admin()` — which is false, because on a brand new
-- project there is no administrator yet. That is the deadlock: you cannot
-- become an administrator without already being one.
--
--   ERROR: 42501: Only an administrator may change a role or active status
--
-- Every new project hit this on the documented first-admin step, so the
-- system could not be set up at all.
--
-- The fix widens the exemption to any session with no authenticated user.
-- See the reasoning inline below — it is narrower than it first looks.
-- =====================================================================

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A session with no authenticated user is not a user of this application.
  --
  -- `profiles` has RLS both ENABLED and FORCED, and its only UPDATE policies
  -- are granted `to authenticated`. So the one and only way to arrive at this
  -- trigger with a NULL `auth.uid()` is to have bypassed RLS entirely, which
  -- needs the BYPASSRLS attribute: the service role, or someone holding the
  -- database credentials in the SQL editor.
  --
  -- Both are already inside the database. A row trigger cannot meaningfully
  -- restrain a caller who could equally well disable the trigger, rewrite the
  -- function, or update the table directly — and pretending otherwise bought
  -- no security while making setup impossible.
  --
  -- An anonymous web request is NOT covered by this: it never reaches here,
  -- because RLS rejects the UPDATE first. `rls_profiles.test.sql` asserts
  -- exactly that, so this stays a bootstrap hatch and not a hole.
  if (select auth.uid()) is null
     or auth.role() = 'service_role' then
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

comment on function public.protect_profile_fields() is
  'Blocks privilege escalation through the ordinary profile update path. '
  'Exempts sessions with no authenticated user — the service role and the '
  'SQL editor — because those already hold rights this trigger cannot '
  'constrain, and the first administrator has to be created somehow.';
