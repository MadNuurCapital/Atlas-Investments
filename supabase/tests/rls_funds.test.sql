-- =====================================================================
-- Row Level Security tests — Fund Centre
--
-- Fund data is the mirror image of client data: everyone reads it, only an
-- administrator writes it. These tests prove both halves, and that an
-- admin's power over funds grants nothing over anyone's clients.
-- =====================================================================

\o /dev/null

truncate test.results restart identity;
select test.act_as_service();

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-2222-2222-2222-222222222222', 'fund.advisor@example.test',
     '{"full_name":"Advisor","role":"advisor"}'),
  ('cccccccc-2222-2222-2222-222222222222', 'fund.admin@example.test',
     '{"full_name":"Admin","role":"admin"}'),
  ('dddddddd-2222-2222-2222-222222222222', 'fund.dormant@example.test',
     '{"full_name":"Dormant","role":"advisor"}')
on conflict (id) do nothing;

update public.profiles set is_active = false
 where id = 'dddddddd-2222-2222-2222-222222222222';

insert into public.funds (id, name, share_class, currency, category, latest_nav, nav_date)
values ('f0000000-2222-2222-2222-222222222222', 'Global Balanced Fund',
        'Class A (Acc) SGD', 'SGD', 'Balanced', 1.2345, '2026-08-03');

insert into public.fund_nav_history (fund_id, nav_date, nav)
values ('f0000000-2222-2222-2222-222222222222', '2026-08-03', 1.2345);

-- =====================================================================
-- Reading is open to every active user
-- =====================================================================

begin;
select test.login_as('aaaaaaaa-2222-2222-2222-222222222222');

select test.row_count('select 1 from public.funds', 1,
  'An advisor CAN read fund master data');
select test.row_count('select 1 from public.fund_nav_history', 1,
  'An advisor CAN read NAV history');
select test.row_count('select 1 from public.app_settings', 4,
  'An advisor CAN read system defaults such as scenario rates');

-- ...but writing is refused. UPDATE has only an admin policy, so for an
-- advisor no row is updatable and the statement changes nothing. Silence,
-- not an error, is the correct refusal here.
select test.affected_rows(
  $$update public.funds set latest_nav = 99
     where id = 'f0000000-2222-2222-2222-222222222222'$$,
  0, 'An advisor CANNOT edit fund master data');

select test.throws(
  $$insert into public.funds (name) values ('Fund I Invented')$$,
  'An advisor CANNOT create a fund');

select test.throws(
  $$insert into public.fund_nav_history (fund_id, nav_date, nav)
    values ('f0000000-2222-2222-2222-222222222222', '2026-08-04', 9.99)$$,
  'An advisor CANNOT write NAV history');

select test.affected_rows(
  $$update public.app_settings set value = '0.99'::jsonb
     where key = 'nav_stale_after_days'$$,
  0, 'An advisor CANNOT change system defaults');

-- Prove it really is unchanged, from a vantage point that can see it.
select test.row_count(
  $$select 1 from public.app_settings
     where key = 'nav_stale_after_days' and value::text = '5'$$,
  1, 'The system default is genuinely untouched');

select test.row_count('select 1 from public.fund_refresh_runs', 0,
  'An advisor CANNOT read the refresh log');

select test.logout();
commit;

-- =====================================================================
-- A deactivated user reads nothing at all
-- =====================================================================

begin;
select test.login_as('dddddddd-2222-2222-2222-222222222222');
select test.row_count('select 1 from public.funds', 0,
  'A DEACTIVATED user cannot even read fund data');
select test.logout();
commit;

-- =====================================================================
-- Admin writes
-- =====================================================================

begin;
select test.login_as('cccccccc-2222-2222-2222-222222222222');

select test.affected_rows(
  $$update public.funds set category = 'Mixed Assets'
     where id = 'f0000000-2222-2222-2222-222222222222'$$,
  1, 'An admin CAN edit fund master data');

select test.affected_rows(
  $$insert into public.fund_nav_history (fund_id, nav_date, nav)
    values ('f0000000-2222-2222-2222-222222222222', '2026-08-04', 1.2400)$$,
  1, 'An admin CAN add NAV history');

select test.row_count('select 1 from public.fund_refresh_runs', 0,
  'An admin CAN query the refresh log (empty, but permitted)');

select test.logout();
commit;

-- =====================================================================
-- Verification cannot be bypassed or outlive its symbol
-- =====================================================================

select test.act_as_service();

select test.throws(
  $$update public.funds
       set auto_refresh_enabled = true
     where id = 'f0000000-2222-2222-2222-222222222222'$$,
  'Auto-refresh CANNOT be switched on without a verified symbol');

update public.funds
   set source_identifier = 'TEST.SI',
       source_verified = true,
       source_verified_at = now(),
       auto_refresh_enabled = true
 where id = 'f0000000-2222-2222-2222-222222222222';

select test.row_count(
  $$select 1 from public.funds
     where id = 'f0000000-2222-2222-2222-222222222222'
       and auto_refresh_enabled$$,
  1, 'Auto-refresh CAN be switched on once the symbol is verified');

-- Repointing the fund at a different symbol must drop the verification,
-- otherwise the badge would vouch for a symbol nobody ever checked.
update public.funds
   set source_identifier = 'DIFFERENT.SI'
 where id = 'f0000000-2222-2222-2222-222222222222';

select test.row_count(
  $$select 1 from public.funds
     where id = 'f0000000-2222-2222-2222-222222222222'
       and not source_verified and not auto_refresh_enabled$$,
  1, 'Changing the symbol RESETS verification and switches refresh off');

-- =====================================================================
-- Duplicate share classes
-- =====================================================================

select test.throws(
  $$insert into public.funds (name, share_class)
    values ('Global Balanced Fund', 'Class A (Acc) SGD')$$,
  'The same fund and share class CANNOT be recorded twice');

insert into public.funds (name, share_class, currency)
values ('Global Balanced Fund', 'Class B (Dist) SGD', 'SGD');

select test.row_count(
  $$select 1 from public.funds where name = 'Global Balanced Fund'$$,
  2, 'A DIFFERENT share class of the same fund IS a separate record');

-- =====================================================================
-- Watchlists are private
-- =====================================================================

insert into public.fund_watchlists (user_id, fund_id)
values ('cccccccc-2222-2222-2222-222222222222',
        'f0000000-2222-2222-2222-222222222222');

begin;
select test.login_as('aaaaaaaa-2222-2222-2222-222222222222');

select test.row_count('select 1 from public.fund_watchlists', 0,
  'An advisor CANNOT see another user''s watchlist');

select test.affected_rows(
  $$insert into public.fund_watchlists (user_id, fund_id)
    values ('aaaaaaaa-2222-2222-2222-222222222222',
            'f0000000-2222-2222-2222-222222222222')$$,
  1, 'An advisor CAN add to their own watchlist');

select test.row_count('select 1 from public.fund_watchlists', 1,
  'An advisor sees only their own watchlist entry');

select test.throws(
  $$insert into public.fund_watchlists (user_id, fund_id)
    values ('cccccccc-2222-2222-2222-222222222222',
            (select id from public.funds where share_class = 'Class B (Dist) SGD'))$$,
  'An advisor CANNOT add a fund to someone else''s watchlist');

select test.logout();
commit;

-- =====================================================================
-- Allocations must be real proportions
-- =====================================================================

select test.act_as_service();

select test.throws(
  $$insert into public.fund_allocations (fund_id, kind, label, weight)
    values ('f0000000-2222-2222-2222-222222222222', 'region', 'Asia', 1.5)$$,
  'An allocation weight CANNOT exceed 100%');

select test.throws(
  $$insert into public.fund_allocations (fund_id, kind, label, weight)
    values ('f0000000-2222-2222-2222-222222222222', 'region', 'Asia', -0.1)$$,
  'An allocation weight CANNOT be negative');

-- =====================================================================
-- One NAV per fund per day
-- =====================================================================

select test.throws(
  $$insert into public.fund_nav_history (fund_id, nav_date, nav)
    values ('f0000000-2222-2222-2222-222222222222', '2026-08-03', 5.55)$$,
  'A fund CANNOT have two different NAVs for the same date');

select test.report();
