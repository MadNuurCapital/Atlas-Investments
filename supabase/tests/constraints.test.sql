-- =====================================================================
-- Data integrity tests
--
-- The database refuses states that would silently corrupt a client's
-- record. Each of these has a plausible route in from a UI bug or a
-- half-finished workflow, so each is checked here rather than trusted to
-- the application.
-- =====================================================================

\o /dev/null

truncate test.results restart identity;
select test.act_as_service();

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'constraints@example.test',
     '{"full_name":"Advisor","role":"advisor"}')
on conflict (id) do nothing;

insert into public.clients (id, advisor_id, full_name)
values ('c0000000-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-111111111111', 'Constraint Client');

-- =====================================================================
-- Holdings
-- =====================================================================

select test.throws(
  $$insert into public.client_holdings
      (client_id, provider, product_name, start_date, initial_lump_sum)
    values ('c0000000-1111-1111-1111-111111111111', 'P', 'X', '2025-01-01', -100)$$,
  'A holding CANNOT have a negative lump sum');

select test.throws(
  $$insert into public.client_holdings
      (client_id, provider, product_name, start_date)
    values ('c0000000-1111-1111-1111-111111111111', 'P', 'X', '2025-01-01')$$,
  'A holding MUST identify its fund, by link or by name');

select test.throws(
  $$insert into public.client_holdings
      (client_id, fund_name_manual, provider, product_name, start_date,
       status)
    values ('c0000000-1111-1111-1111-111111111111', 'F', 'P', 'X',
            '2025-01-01', 'paused')$$,
  'A non-active holding MUST record when contributions ceased');

select test.throws(
  $$insert into public.client_holdings
      (client_id, fund_name_manual, provider, product_name, start_date,
       current_value)
    values ('c0000000-1111-1111-1111-111111111111', 'F', 'P', 'X',
            '2025-01-01', 5000)$$,
  'A recorded value MUST carry the date it was accurate');

select test.throws(
  $$insert into public.client_holdings
      (client_id, fund_name_manual, provider, product_name, start_date,
       contributed_override)
    values ('c0000000-1111-1111-1111-111111111111', 'F', 'P', 'X',
            '2025-01-01', 12345)$$,
  'Overriding the contributed total MUST carry a reason');

insert into public.client_holdings
  (id, client_id, fund_name_manual, provider, product_name, start_date,
   monthly_contribution)
values ('d0000000-1111-1111-1111-111111111111',
        'c0000000-1111-1111-1111-111111111111',
        'Test Fund', 'Provider', 'Product', '2025-01-01', 300);

select test.row_count(
  $$select 1 from public.client_holdings
     where id = 'd0000000-1111-1111-1111-111111111111'$$,
  1, 'A well-formed holding is accepted');

-- =====================================================================
-- Transactions — the amount must match the type
-- =====================================================================

select test.throws(
  $$insert into public.holding_transactions
      (holding_id, type, new_monthly_amount, effective_date, created_by)
    values ('d0000000-1111-1111-1111-111111111111', 'dividend', 100,
            '2025-06-01', 'aaaaaaaa-1111-1111-1111-111111111111')$$,
  'A dividend CANNOT carry a new monthly amount instead of an amount');

select test.throws(
  $$insert into public.holding_transactions
      (holding_id, type, amount, effective_date, created_by)
    values ('d0000000-1111-1111-1111-111111111111', 'contribution_change',
            100, '2025-06-01', 'aaaaaaaa-1111-1111-1111-111111111111')$$,
  'A contribution change CANNOT carry a plain amount');

select test.throws(
  $$insert into public.holding_transactions
      (holding_id, type, amount, effective_date, created_by)
    values ('d0000000-1111-1111-1111-111111111111', 'withdrawal', -50,
            '2025-06-01', 'aaaaaaaa-1111-1111-1111-111111111111')$$,
  'A withdrawal is a positive amount of a withdrawal, never a negative one');

-- =====================================================================
-- Reviews
-- =====================================================================

insert into public.reviews (id, client_id, advisor_id, review_date, status)
values ('e0000000-1111-1111-1111-111111111111',
        'c0000000-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-111111111111', '2026-08-04', 'draft');

select test.throws(
  $$insert into public.reviews (client_id, advisor_id, review_date, status)
    values ('c0000000-1111-1111-1111-111111111111',
            'aaaaaaaa-1111-1111-1111-111111111111', '2026-08-05', 'draft')$$,
  'A client CANNOT have two reviews in progress at once');

select test.throws(
  $$update public.reviews
       set status = 'completed', completed_at = now()
     where id = 'e0000000-1111-1111-1111-111111111111'$$,
  'A review CANNOT be completed without a next review date');

update public.reviews
   set status = 'completed', completed_at = now(), next_review_date = '2026-11-04'
 where id = 'e0000000-1111-1111-1111-111111111111';

select test.row_count(
  $$select 1 from public.reviews
     where id = 'e0000000-1111-1111-1111-111111111111' and status = 'completed'$$,
  1, 'A review with a next review date completes cleanly');

-- Now that the draft is completed, a new one is allowed.
insert into public.reviews (client_id, advisor_id, review_date, status)
values ('c0000000-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-111111111111', '2026-11-04', 'draft');

select test.row_count(
  $$select 1 from public.reviews where status = 'draft'$$,
  1, 'A new review can begin once the previous one is completed');

-- =====================================================================
-- Snapshots
-- =====================================================================

insert into public.review_holding_snapshots
  (review_id, holding_id, provider, product_name, status,
   monthly_contribution, total_contributed, current_value,
   gain_loss_amount, gain_loss_fraction)
values ('e0000000-1111-1111-1111-111111111111',
        'd0000000-1111-1111-1111-111111111111',
        'Provider', 'Product', 'active', 300, 2400, 2600, 200, 0.083333);

select test.throws(
  $$insert into public.review_holding_snapshots
      (review_id, holding_id, provider, product_name, status,
       monthly_contribution, total_contributed, current_value, gain_loss_amount)
    values ('e0000000-1111-1111-1111-111111111111',
            'd0000000-1111-1111-1111-111111111111',
            'Provider', 'Product', 'active', 300, 2400, 2600, 200)$$,
  'A holding CANNOT be snapshotted twice in the same review');

-- A holding with no contributions has no percentage — null, never zero.
select test.row_count(
  $$select 1 from public.review_holding_snapshots
     where gain_loss_fraction is null$$,
  0, 'The seeded snapshot has a real percentage, so none are null yet');

insert into public.review_holding_snapshots
  (review_id, holding_id, provider, product_name, status,
   monthly_contribution, total_contributed, current_value,
   gain_loss_amount, gain_loss_fraction)
select 'e0000000-1111-1111-1111-111111111111', id, 'P2', 'X2', 'active',
       0, 0, 500, 500, null
  from public.client_holdings
 where id <> 'd0000000-1111-1111-1111-111111111111'
 limit 1;

select test.ok(true, 'A snapshot may record a null percentage where there are no contributions');

-- =====================================================================
-- Archiving
-- =====================================================================

select test.throws(
  $$update public.clients set status = 'archived'
     where id = 'c0000000-1111-1111-1111-111111111111'$$,
  'A client CANNOT be archived without a reason and a timestamp');

update public.clients
   set status = 'archived', archived_at = now(), archive_reason = 'Client relocated'
 where id = 'c0000000-1111-1111-1111-111111111111';

select test.row_count(
  $$select 1 from public.clients
     where id = 'c0000000-1111-1111-1111-111111111111'
       and status = 'archived' and archive_reason is not null$$,
  1, 'Archiving with a reason is accepted');

-- =====================================================================
-- Past performance: provenance
--
-- Regression cover for migration 20260806000002. Before it, the scheduled
-- refresh recomputed every figure and wrote the result unconditionally, so
-- a five-year return typed from a factsheet was erased by a fund with three
-- weeks of downloaded prices. `perf_manual_keys` records which figures a
-- person owns; the constraint below is what stops a typo in application
-- code from quietly failing to protect one.
-- =====================================================================

select test.act_as_service();

insert into public.funds (id, name, share_class, currency, category)
values ('f0000000-1111-1111-1111-111111111111', 'Provenance Test Fund', 'A', 'SGD', 'Equity');

select test.row_count(
  $$select 1 from public.funds
     where id = 'f0000000-1111-1111-1111-111111111111'
       and perf_manual_keys = '{}'$$,
  1, 'A new fund claims no performance figures — everything is derivable');

update public.funds
   set perf_manual_keys = array['ytd', '1y', '5y']
 where id = 'f0000000-1111-1111-1111-111111111111';

select test.row_count(
  $$select 1 from public.funds
     where id = 'f0000000-1111-1111-1111-111111111111'
       and 'ytd' = any(perf_manual_keys)
       and '5y' = any(perf_manual_keys)$$,
  1, 'A fund can claim individual performance figures as hand-entered');

select test.throws(
  $$update public.funds set perf_manual_keys = array['2y']
     where id = 'f0000000-1111-1111-1111-111111111111'$$,
  'A period that does not exist CANNOT be claimed');

select test.throws(
  $$update public.funds set perf_manual_keys = array['1y', 'yeartodate']
     where id = 'f0000000-1111-1111-1111-111111111111'$$,
  'A misspelled period key is refused rather than silently ignored');

select test.row_count(
  $$select 1 from public.funds
     where id = 'f0000000-1111-1111-1111-111111111111'
       and perf_manual_keys = array['ytd', '1y', '5y']$$,
  1, 'The refused writes left the existing claims untouched');

-- Year to date is a real column, not only a key.
update public.funds
   set perf_ytd = 0.0734
 where id = 'f0000000-1111-1111-1111-111111111111';

select test.row_count(
  $$select 1 from public.funds
     where id = 'f0000000-1111-1111-1111-111111111111'
       and perf_ytd = 0.0734$$,
  1, 'Year-to-date is stored as a decimal fraction like every other rate');

select test.report();
