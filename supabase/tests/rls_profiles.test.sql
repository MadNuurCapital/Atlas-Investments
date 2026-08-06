-- =====================================================================
-- Row Level Security tests — profiles, roles and privilege escalation
--
-- These run against the real migrations. They are the evidence that the
-- security rules described in the README actually hold, rather than being
-- assumed because the interface hides a button.
-- =====================================================================

-- Assertions report through RAISE NOTICE (stderr); silence the routine
-- query output so the run reads as a clean pass/fail list.
\o /dev/null

truncate test.results restart identity;

-- ---------------------------------------------------------------------
-- Fixtures: two advisors, one admin, one deactivated advisor.
--
-- Created while acting as the service role, which is how Supabase's
-- invitation flow and admin server actions really run. Note that even
-- setting up these fixtures is blocked without it — the protection trigger
-- is doing its job before a single test has run.
-- ---------------------------------------------------------------------

select test.act_as_service();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'advisor.a@example.test',
     '{"full_name":"Advisor A","role":"advisor"}'),
  ('22222222-2222-2222-2222-222222222222', 'advisor.b@example.test',
     '{"full_name":"Advisor B","role":"advisor"}'),
  ('33333333-3333-3333-3333-333333333333', 'admin@example.test',
     '{"full_name":"The Admin","role":"admin"}'),
  ('44444444-4444-4444-4444-444444444444', 'dormant@example.test',
     '{"full_name":"Dormant Advisor","role":"advisor"}');

-- The on_auth_user_created trigger should have mirrored all four.
select test.row_count(
  'select 1 from public.profiles',
  4,
  'Invitation trigger creates a profile for every new auth user'
);

select test.row_count(
  $$select 1 from public.profiles
     where id = '33333333-3333-3333-3333-333333333333' and role = 'admin'$$,
  1,
  'Role travels from invitation metadata into the profile'
);

update public.profiles set is_active = false
  where id = '44444444-4444-4444-4444-444444444444';

-- =====================================================================
-- Reading profiles
-- =====================================================================

begin;
select test.login_as('11111111-1111-1111-1111-111111111111');

select test.row_count(
  'select 1 from public.profiles',
  1,
  'Advisor A sees only their own profile, not the other three'
);

select test.row_count(
  $$select 1 from public.profiles
     where id = '22222222-2222-2222-2222-222222222222'$$,
  0,
  'Advisor A cannot read Advisor B''s profile even when naming the id'
);

select test.logout();
commit;

begin;
select test.login_as('33333333-3333-3333-3333-333333333333');

select test.row_count(
  'select 1 from public.profiles',
  4,
  'Admin sees every profile, for user management'
);

select test.logout();
commit;

-- =====================================================================
-- Privilege escalation — the attacks that matter most
-- =====================================================================

begin;
select test.login_as('11111111-1111-1111-1111-111111111111');

select test.throws(
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  'An advisor CANNOT promote themselves to admin'
);

select test.throws(
  $$update public.profiles set is_active = false
     where id = '11111111-1111-1111-1111-111111111111'$$,
  'An advisor CANNOT change their own active status'
);

-- Changing display name and theme is the legitimate use of this policy.
update public.profiles
   set full_name = 'Advisor A Renamed', theme_preference = 'dark'
 where id = '11111111-1111-1111-1111-111111111111';

select test.row_count(
  $$select 1 from public.profiles
     where id = '11111111-1111-1111-1111-111111111111'
       and full_name = 'Advisor A Renamed'
       and theme_preference = 'dark'$$,
  1,
  'An advisor CAN update their own display name and theme'
);

-- This one does not raise: RLS makes Advisor B's row invisible, so the
-- UPDATE matches nothing and succeeds against zero rows. Silence, not an
-- error, is the correct behaviour — and worth asserting explicitly.
select test.affected_rows(
  $$update public.profiles set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'$$,
  0,
  'An advisor cannot promote another user (the row is invisible, so nothing changes)'
);

select test.throws(
  $$insert into public.profiles (id, email)
    values ('55555555-5555-5555-5555-555555555555', 'ghost@example.test')$$,
  'An advisor CANNOT insert a profile out of thin air'
);

select test.throws(
  $$delete from public.profiles
     where id = '11111111-1111-1111-1111-111111111111'$$,
  'Profiles CANNOT be deleted from the application — deactivate instead'
);

select test.logout();
commit;

-- =====================================================================
-- Admin powers, and their limits
-- =====================================================================

begin;
select test.login_as('33333333-3333-3333-3333-333333333333');

update public.profiles set is_active = false
 where id = '22222222-2222-2222-2222-222222222222';

select test.row_count(
  $$select 1 from public.profiles
     where id = '22222222-2222-2222-2222-222222222222' and is_active = false$$,
  1,
  'An admin CAN deactivate another user'
);

update public.profiles set is_active = true
 where id = '22222222-2222-2222-2222-222222222222';

select test.throws(
  $$update public.profiles set role = 'advisor'
     where id = '33333333-3333-3333-3333-333333333333'$$,
  'An admin CANNOT demote themselves — that would lock everyone out'
);

select test.throws(
  $$update public.profiles set is_active = false
     where id = '33333333-3333-3333-3333-333333333333'$$,
  'An admin CANNOT deactivate themselves'
);

select test.logout();
commit;

-- =====================================================================
-- Deactivated users
-- =====================================================================

begin;
select test.login_as('44444444-4444-4444-4444-444444444444');

select test.ok(
  public.is_active_user() = false,
  'is_active_user() is false for a deactivated user'
);

-- The update policy requires is_active_user(), so for a deactivated user the
-- row simply is not updatable. RLS refuses by making it invisible rather than
-- by raising, so the assertion is "nothing changed", not "it errored".
select test.affected_rows(
  $$update public.profiles set full_name = 'Sneaky'
     where id = '44444444-4444-4444-4444-444444444444'$$,
  0,
  'A deactivated user CANNOT update their own profile'
);

select test.logout();
commit;

-- Confirm from a trusted vantage point that the value really is untouched.
select test.act_as_service();
select test.row_count(
  $$select 1 from public.profiles
     where id = '44444444-4444-4444-4444-444444444444'
       and full_name = 'Dormant Advisor'$$,
  1,
  'The deactivated user''s stored name is genuinely unchanged'
);

-- =====================================================================
-- Helper functions must not be fooled
-- =====================================================================

begin;
select test.login_as('11111111-1111-1111-1111-111111111111');
select test.ok(public.is_admin() = false, 'is_admin() is false for an advisor');
select test.ok(
  public.current_app_role() = 'advisor',
  'current_app_role() reports the caller''s real role'
);
select test.logout();
commit;

begin;
select test.login_as('33333333-3333-3333-3333-333333333333');
select test.ok(public.is_admin() = true, 'is_admin() is true for an active admin');
select test.logout();
commit;

-- An admin who has been deactivated keeps the role but loses the power.
update public.profiles set is_active = false
  where id = '33333333-3333-3333-3333-333333333333';

begin;
select test.login_as('33333333-3333-3333-3333-333333333333');
select test.ok(
  public.is_admin() = false,
  'is_admin() is false for a DEACTIVATED admin'
);
select test.logout();
commit;

update public.profiles set is_active = true
  where id = '33333333-3333-3333-3333-333333333333';

-- =====================================================================
-- Anonymous access
-- =====================================================================

begin;
set local role anon;
select test.row_count(
  'select 1 from public.profiles',
  0,
  'A signed-out visitor sees no profiles at all'
);

-- This one guards the bootstrap hatch below. The hatch lets a session with
-- no authenticated user change a role — safe only because RLS stops such a
-- session reaching the trigger in the first place. An anonymous caller also
-- has no `auth.uid()`, so if RLS ever stopped blocking it, the hatch would
-- become a public privilege-escalation route. This assertion is what keeps
-- that from happening quietly.
select test.affected_rows(
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  0,
  'A signed-out visitor cannot promote anyone — RLS blocks it before the trigger'
);
reset role;
commit;

select test.row_count(
  $$select 1 from public.profiles
     where id = '11111111-1111-1111-1111-111111111111' and role = 'advisor'$$,
  1,
  'Advisor A is still an advisor after the anonymous attempt'
);

-- =====================================================================
-- Bootstrapping the first administrator
--
-- Regression cover for the deadlock fixed in 20260806000001. A brand new
-- project has no administrator, so the first one must be made from the SQL
-- editor: database credentials, no JWT. Before the fix
-- `protect_profile_fields()` rejected that with 42501, because the only
-- exemption tested `auth.role() = 'service_role'` and the SQL editor sends
-- no role claim at all. The result was a project that could not be set up.
-- =====================================================================

select test.act_as_sql_editor();

-- Prove the fixture really is what the deadlock looked like: no JWT role,
-- so the old service-role exemption would not have fired.
select test.ok(
  (select auth.uid()) is null and coalesce(auth.role(), '') <> 'service_role',
  'The SQL editor session carries no authenticated user and no service role'
);

select test.affected_rows(
  $$update public.profiles set role = 'admin'
     where id = '22222222-2222-2222-2222-222222222222'$$,
  1,
  'The first administrator can be created from the SQL editor'
);

select test.row_count(
  $$select 1 from public.profiles
     where id = '22222222-2222-2222-2222-222222222222' and role = 'admin'$$,
  1,
  'The promotion is genuinely persisted, not merely left unrejected'
);

-- The hatch is only about who is asking. An advisor still cannot promote
-- themselves through the application, which is the property that matters.
begin;
select test.login_as('11111111-1111-1111-1111-111111111111');
-- Refused loudly, not silently: RLS lets an advisor update their OWN row,
-- so the statement reaches the trigger and the trigger raises.
select test.throws(
  $$update public.profiles set role = 'admin'
     where id = '11111111-1111-1111-1111-111111111111'$$,
  'An advisor still cannot promote themselves after the bootstrap fix'
);
select test.logout();
commit;

select test.row_count(
  $$select 1 from public.profiles
     where id = '11111111-1111-1111-1111-111111111111' and role = 'advisor'$$,
  1,
  'Advisor A is still an advisor'
);

select test.report();
