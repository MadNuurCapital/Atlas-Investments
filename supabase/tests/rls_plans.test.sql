-- =====================================================================
-- Row Level Security tests — saved calculations and portfolio scenarios
--
-- Saved work belongs to whoever made it. When it is attached to a client
-- it becomes client data, and the ownership rule applies to it too.
-- =====================================================================

\o /dev/null

truncate test.results restart identity;
select test.act_as_service();

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-3333-3333-3333-333333333333', 'plan.a@example.test',
     '{"full_name":"Advisor A","role":"advisor"}'),
  ('bbbbbbbb-3333-3333-3333-333333333333', 'plan.b@example.test',
     '{"full_name":"Advisor B","role":"advisor"}'),
  ('cccccccc-3333-3333-3333-333333333333', 'plan.admin@example.test',
     '{"full_name":"Admin","role":"admin"}')
on conflict (id) do nothing;

insert into public.clients (id, advisor_id, full_name) values
  ('c1111111-3333-3333-3333-333333333333',
   'aaaaaaaa-3333-3333-3333-333333333333', 'Client Of A'),
  ('c2222222-3333-3333-3333-333333333333',
   'bbbbbbbb-3333-3333-3333-333333333333', 'Client Of B');

insert into public.funds (id, name, share_class, currency) values
  ('f1111111-3333-3333-3333-333333333333', 'Plan Test Fund', 'Class A', 'SGD');

insert into public.saved_calculations
  (id, owner_id, client_id, calculator_type, title, inputs, outputs, assumptions)
values
  ('50000000-3333-3333-3333-333333333333',
   'aaaaaaaa-3333-3333-3333-333333333333',
   'c1111111-3333-3333-3333-333333333333',
   'projection', 'A''s plan for their client',
   '{"initialAmount":10000}'::jsonb, '{"futureValue":16288}'::jsonb,
   '{"rates":{"moderate":0.05}}'::jsonb),
  ('50000000-3333-3333-3333-333333333334',
   'bbbbbbbb-3333-3333-3333-333333333333',
   'c2222222-3333-3333-3333-333333333333',
   'hajj', 'B''s plan for their client',
   '{"currentCost":30000}'::jsonb, '{"futureCost":48866}'::jsonb,
   '{"rates":{"moderate":0.05}}'::jsonb);

-- An unattached plan, belonging to A alone.
insert into public.saved_calculations
  (owner_id, calculator_type, title, inputs, outputs, assumptions)
values
  ('aaaaaaaa-3333-3333-3333-333333333333', 'affordability',
   'A''s private scratch calculation',
   '{"monthlyIncome":5000}'::jsonb, '{"surplus":1500}'::jsonb, '{}'::jsonb);

insert into public.portfolio_scenarios (id, owner_id, client_id, name)
values ('60000000-3333-3333-3333-333333333333',
        'aaaaaaaa-3333-3333-3333-333333333333',
        'c1111111-3333-3333-3333-333333333333', 'A''s portfolio');

insert into public.portfolio_scenario_items (scenario_id, fund_id, allocation)
values ('60000000-3333-3333-3333-333333333333',
        'f1111111-3333-3333-3333-333333333333', 0.25);

-- =====================================================================
-- Ownership
-- =====================================================================

begin;
select test.login_as('aaaaaaaa-3333-3333-3333-333333333333');

select test.row_count('select 1 from public.saved_calculations', 2,
  'Advisor A sees their two saved calculations');

select test.row_count(
  $$select 1 from public.saved_calculations where title like '%B''s%'$$,
  0, 'Advisor A CANNOT see Advisor B''s saved calculations');

select test.row_count('select 1 from public.portfolio_scenarios', 1,
  'Advisor A sees their own portfolio scenario');

select test.row_count('select 1 from public.portfolio_scenario_items', 1,
  'Advisor A sees the funds inside their own scenario');

select test.throws(
  $$insert into public.saved_calculations
      (owner_id, calculator_type, title, inputs, outputs, assumptions)
    values ('bbbbbbbb-3333-3333-3333-333333333333', 'projection',
            'Planted', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)$$,
  'Advisor A CANNOT create a saved calculation owned by Advisor B');

select test.throws(
  $$insert into public.saved_calculations
      (owner_id, client_id, calculator_type, title, inputs, outputs, assumptions)
    values ('aaaaaaaa-3333-3333-3333-333333333333',
            'c2222222-3333-3333-3333-333333333333', 'projection',
            'Attached to B''s client', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)$$,
  'Advisor A CANNOT attach their own calculation to Advisor B''s client');

select test.affected_rows(
  $$update public.saved_calculations set title = 'Hijacked'
     where id = '50000000-3333-3333-3333-333333333334'$$,
  0, 'Advisor A CANNOT rename Advisor B''s saved calculation');

select test.logout();
commit;

begin;
select test.login_as('bbbbbbbb-3333-3333-3333-333333333333');
select test.row_count('select 1 from public.saved_calculations', 1,
  'Advisor B sees only their own saved calculation');
select test.row_count('select 1 from public.portfolio_scenarios', 0,
  'Advisor B sees none of Advisor A''s portfolio scenarios');
select test.row_count('select 1 from public.portfolio_scenario_items', 0,
  'Advisor B sees none of the funds inside Advisor A''s scenario');
select test.logout();
commit;

-- =====================================================================
-- The admin, again
-- =====================================================================

begin;
select test.login_as('cccccccc-3333-3333-3333-333333333333');

select test.ok(public.is_admin(), 'The admin fixture really is an admin');

select test.row_count('select 1 from public.saved_calculations', 0,
  'An ADMIN sees ZERO saved calculations belonging to advisors');

select test.row_count('select 1 from public.portfolio_scenarios', 0,
  'An ADMIN sees ZERO portfolio scenarios belonging to advisors');

select test.row_count('select 1 from public.portfolio_scenario_items', 0,
  'An ADMIN sees ZERO scenario fund allocations');

-- ...while still having full control of the fund the scenario references.
select test.row_count('select 1 from public.funds', 1,
  'An ADMIN still sees the fund itself — reference data, not client data');

select test.logout();
commit;

-- =====================================================================
-- Allocation bounds
-- =====================================================================

select test.act_as_service();

select test.throws(
  $$insert into public.portfolio_scenario_items (scenario_id, fund_id, allocation)
    values ('60000000-3333-3333-3333-333333333333',
            'f1111111-3333-3333-3333-333333333333', 1.5)$$,
  'A scenario allocation CANNOT exceed 100%');

select test.throws(
  $$insert into public.portfolio_scenario_items (scenario_id, fund_id, allocation)
    values ('60000000-3333-3333-3333-333333333333',
            'f1111111-3333-3333-3333-333333333333', -0.2)$$,
  'A scenario allocation CANNOT be negative');

select test.throws(
  $$insert into public.portfolio_scenario_items (scenario_id, fund_id, allocation)
    values ('60000000-3333-3333-3333-333333333333',
            'f1111111-3333-3333-3333-333333333333', 0.3)$$,
  'The same fund CANNOT appear twice in one scenario');

select test.throws(
  $$insert into public.portfolio_scenarios (owner_id, name, years)
    values ('aaaaaaaa-3333-3333-3333-333333333333', 'Too long', 200)$$,
  'A scenario CANNOT run for 200 years');

-- =====================================================================
-- Deactivation
-- =====================================================================

update public.profiles set is_active = false
 where id = 'aaaaaaaa-3333-3333-3333-333333333333';

begin;
select test.login_as('aaaaaaaa-3333-3333-3333-333333333333');
select test.row_count('select 1 from public.saved_calculations', 0,
  'A DEACTIVATED advisor loses access to their own saved calculations');
select test.logout();
commit;

select test.report();
