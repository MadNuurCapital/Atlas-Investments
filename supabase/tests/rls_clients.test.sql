-- =====================================================================
-- Row Level Security tests — client data isolation
--
-- This is the file that matters most in the whole repository. It proves,
-- against a real database, that:
--
--   * Advisor A cannot see, change or even count Advisor B's clients,
--     holdings, transactions, reviews, snapshots or audit trail.
--   * An ADMIN cannot either. Being an administrator grants power over
--     users, funds and settings — never over another advisor's clients.
--   * A deactivated advisor loses access to their own clients.
--
-- If any assertion here fails, the product's core promise is broken and
-- nothing should be deployed.
-- =====================================================================

\o /dev/null

truncate test.results restart identity;
select test.act_as_service();

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------

delete from public.audit_events;
delete from public.review_holding_snapshots;
delete from public.holding_transactions;
delete from public.reviews;
delete from public.client_holdings;
delete from public.clients;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls.advisor.a@example.test',
     '{"full_name":"Advisor A","role":"advisor"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'rls.advisor.b@example.test',
     '{"full_name":"Advisor B","role":"advisor"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'rls.admin@example.test',
     '{"full_name":"The Admin","role":"admin"}')
on conflict (id) do nothing;

-- Advisor A's client, and Advisor B's client.
insert into public.clients (id, advisor_id, full_name, email, notes, next_review_date) values
  ('c1111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'Client Of A', 'a.client@example.test', 'PRIVATE NOTE BELONGING TO ADVISOR A', '2026-11-04'),
  ('c2222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   'Client Of B', 'b.client@example.test', 'PRIVATE NOTE BELONGING TO ADVISOR B', '2026-10-01');

insert into public.client_holdings
  (id, client_id, fund_name_manual, provider, product_name,
   initial_lump_sum, monthly_contribution, start_date, current_value, current_value_as_of)
values
  ('d1111111-0000-0000-0000-000000000001', 'c1111111-0000-0000-0000-000000000001',
   'Global Balanced Fund A', 'Provider One', 'Product One',
   10000.00, 500.00, '2024-01-15', 22000.00, '2026-08-01'),
  ('d2222222-0000-0000-0000-000000000002', 'c2222222-0000-0000-0000-000000000002',
   'Asia Income Fund B', 'Provider Two', 'Product Two',
   5000.00, 250.00, '2025-03-01', 9000.00, '2026-08-01');

insert into public.holding_transactions
  (holding_id, type, amount, effective_date, created_by)
values
  ('d1111111-0000-0000-0000-000000000001', 'dividend', 120.00, '2026-05-01',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d2222222-0000-0000-0000-000000000002', 'withdrawal', 400.00, '2026-06-01',
   'bbbbbbbb-0000-0000-0000-000000000002');

insert into public.reviews
  (id, client_id, advisor_id, review_date, status, discussion_notes,
   next_review_date, completed_at)
values
  ('e1111111-0000-0000-0000-000000000001', 'c1111111-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', '2026-08-04', 'completed',
   'CONFIDENTIAL DISCUSSION WITH A''S CLIENT', '2026-11-04', now()),
  ('e2222222-0000-0000-0000-000000000002', 'c2222222-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000002', '2026-07-01', 'completed',
   'CONFIDENTIAL DISCUSSION WITH B''S CLIENT', '2026-10-01', now());

insert into public.review_holding_snapshots
  (review_id, holding_id, provider, product_name, status,
   monthly_contribution, total_contributed, current_value,
   gain_loss_amount, gain_loss_fraction)
values
  ('e1111111-0000-0000-0000-000000000001', 'd1111111-0000-0000-0000-000000000001',
   'Provider One', 'Product One', 'active', 500.00, 20000.00, 22000.00, 2120.00, 0.106),
  ('e2222222-0000-0000-0000-000000000002', 'd2222222-0000-0000-0000-000000000002',
   'Provider Two', 'Product Two', 'active', 250.00, 9250.00, 9000.00, 150.00, 0.016216);

insert into public.audit_events (actor_id, scope, client_id, entity_type, action, reason)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'client', 'c1111111-0000-0000-0000-000000000001',
   'client_holdings', 'update_current_value', 'Quarterly statement received'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'client', 'c2222222-0000-0000-0000-000000000002',
   'client_holdings', 'update_current_value', 'Quarterly statement received'),
  ('cccccccc-0000-0000-0000-000000000003', 'system', null,
   'profiles', 'invite_user', 'New advisor onboarded');

-- =====================================================================
-- Advisor A: sees own, sees nothing of B's
-- =====================================================================

begin;
select test.login_as('aaaaaaaa-0000-0000-0000-000000000001');

select test.row_count('select 1 from public.clients', 1,
  'Advisor A sees exactly one client — their own');

select test.row_count(
  $$select 1 from public.clients where id = 'c2222222-0000-0000-0000-000000000002'$$,
  0, 'Advisor A CANNOT read Advisor B''s client, even naming the id');

select test.row_count(
  $$select 1 from public.clients where notes like '%ADVISOR B%'$$,
  0, 'Advisor A CANNOT reach Advisor B''s private notes by searching');

select test.row_count('select 1 from public.client_holdings', 1,
  'Advisor A sees only their own client''s holdings');

select test.row_count('select 1 from public.holding_transactions', 1,
  'Advisor A sees only their own transactions');

select test.row_count('select 1 from public.reviews', 1,
  'Advisor A sees only their own reviews');

select test.row_count(
  $$select 1 from public.reviews where discussion_notes like '%B''S CLIENT%'$$,
  0, 'Advisor A CANNOT read Advisor B''s review notes');

select test.row_count('select 1 from public.review_holding_snapshots', 1,
  'Advisor A sees only their own review snapshots');

select test.row_count('select 1 from public.audit_events', 1,
  'Advisor A sees only the audit trail for their own clients');

-- Writes against another advisor's data must change nothing.
select test.affected_rows(
  $$update public.clients set full_name = 'Hijacked'
     where id = 'c2222222-0000-0000-0000-000000000002'$$,
  0, 'Advisor A CANNOT rename Advisor B''s client');

select test.affected_rows(
  $$update public.client_holdings set current_value = 1
     where id = 'd2222222-0000-0000-0000-000000000002'$$,
  0, 'Advisor A CANNOT alter the value of Advisor B''s holding');

select test.throws(
  $$insert into public.client_holdings
      (client_id, fund_name_manual, provider, product_name, start_date)
    values ('c2222222-0000-0000-0000-000000000002', 'Sneaky Fund',
            'P', 'X', '2026-01-01')$$,
  'Advisor A CANNOT attach a holding to Advisor B''s client');

select test.throws(
  $$insert into public.clients (advisor_id, full_name)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'Planted Client')$$,
  'Advisor A CANNOT create a client owned by Advisor B');

select test.throws(
  $$delete from public.clients where id = 'c1111111-0000-0000-0000-000000000001'$$,
  'Clients CANNOT be deleted, only archived');

-- Snapshots are protected twice over, and each layer is worth asserting
-- separately. First: there is no UPDATE policy at all, so RLS matches no
-- rows and the statement quietly changes nothing.
select test.affected_rows(
  $$update public.review_holding_snapshots set current_value = 999999
     where holding_id = 'd1111111-0000-0000-0000-000000000001'$$,
  0, 'RLS gives nobody permission to update a review snapshot');

select test.logout();
commit;

-- Second: even a caller that bypasses RLS entirely — a server-side job
-- holding the service-role key — is refused by the immutability trigger.
select test.act_as_service();
select test.throws(
  $$update public.review_holding_snapshots set current_value = 999999$$,
  'Review snapshots are immutable even to the service role');

-- =====================================================================
-- Advisor B: the mirror image
-- =====================================================================

begin;
select test.login_as('bbbbbbbb-0000-0000-0000-000000000002');

select test.row_count('select 1 from public.clients', 1,
  'Advisor B sees exactly one client — their own');

select test.row_count(
  $$select 1 from public.clients where id = 'c1111111-0000-0000-0000-000000000001'$$,
  0, 'Advisor B CANNOT read Advisor A''s client');

select test.row_count(
  $$select 1 from public.review_holding_snapshots
     where holding_id = 'd1111111-0000-0000-0000-000000000001'$$,
  0, 'Advisor B CANNOT read Advisor A''s snapshots');

select test.logout();
commit;

-- =====================================================================
-- THE ADMIN — the assertions the whole privacy model rests on
-- =====================================================================

begin;
select test.login_as('cccccccc-0000-0000-0000-000000000003');

select test.ok(public.is_admin(), 'The admin fixture really is an admin');

select test.row_count('select 1 from public.clients', 0,
  'An ADMIN sees ZERO clients — administration is not client access');

select test.row_count('select 1 from public.client_holdings', 0,
  'An ADMIN sees ZERO holdings');

select test.row_count('select 1 from public.holding_transactions', 0,
  'An ADMIN sees ZERO transactions');

select test.row_count('select 1 from public.reviews', 0,
  'An ADMIN sees ZERO reviews');

select test.row_count('select 1 from public.review_holding_snapshots', 0,
  'An ADMIN sees ZERO review snapshots');

select test.row_count(
  $$select 1 from public.clients where id = 'c1111111-0000-0000-0000-000000000001'$$,
  0, 'An ADMIN cannot read a specific client by id');

-- The audit trail must not become a back door around the rule above.
select test.row_count(
  $$select 1 from public.audit_events where scope = 'client'$$,
  0, 'An ADMIN CANNOT read client-scope audit events — that would be a back door');

select test.row_count(
  $$select 1 from public.audit_events where scope = 'system'$$,
  1, 'An ADMIN CAN read system-scope audit events');

select test.affected_rows(
  $$update public.clients set full_name = 'Admin Was Here'$$,
  0, 'An ADMIN cannot modify any client record');

select test.logout();
commit;

-- =====================================================================
-- An admin who also advises keeps their own book, privately
-- =====================================================================

select test.act_as_service();
insert into public.clients (id, advisor_id, full_name)
values ('c3333333-0000-0000-0000-000000000003',
        'cccccccc-0000-0000-0000-000000000003', 'The Admin''s Own Client');

begin;
select test.login_as('cccccccc-0000-0000-0000-000000000003');
select test.row_count('select 1 from public.clients', 1,
  'An admin who advises sees their OWN client, and still only that one');
select test.logout();
commit;

begin;
select test.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select test.row_count(
  $$select 1 from public.clients where id = 'c3333333-0000-0000-0000-000000000003'$$,
  0, 'An advisor cannot see the admin''s private client either');
select test.logout();
commit;

-- =====================================================================
-- Deactivation revokes access immediately
-- =====================================================================

select test.act_as_service();
update public.profiles set is_active = false
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

begin;
select test.login_as('aaaaaaaa-0000-0000-0000-000000000001');
select test.row_count('select 1 from public.clients', 0,
  'A DEACTIVATED advisor loses access to their own clients');
select test.row_count('select 1 from public.client_holdings', 0,
  'A DEACTIVATED advisor loses access to holdings');
select test.logout();
commit;

select test.act_as_service();
update public.profiles set is_active = true
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- =====================================================================
-- Anonymous
-- =====================================================================

begin;
set local role anon;
select test.row_count('select 1 from public.clients', 0,
  'A signed-out visitor sees no clients');
select test.row_count('select 1 from public.reviews', 0,
  'A signed-out visitor sees no reviews');
reset role;
commit;

select test.report();
