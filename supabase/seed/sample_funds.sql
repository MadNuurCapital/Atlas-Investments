-- =====================================================================
-- SAMPLE FUND DATA — DEVELOPMENT AND DEMONSTRATION ONLY
--
-- Every fund here is fictional. Names are prefixed "SAMPLE —" and symbols
-- are obvious placeholders, so nobody can mistake one for a real fund a
-- client might be invested in.
--
-- This file is NEVER applied automatically. It lives outside
-- supabase/migrations for that reason. Apply it deliberately:
--
--   psql "$DATABASE_URL" -f supabase/seed/sample_funds.sql
--
-- To remove it again:
--
--   delete from public.funds where is_sample;
--
-- Real funds are entered by an administrator from factsheets, with NAV
-- history pasted in bulk. See the Admin onboarding guide in the README.
-- =====================================================================

do $$
begin
  if exists (select 1 from public.funds where not is_sample) then
    raise notice 'Real fund records already exist. Sample data still added; '
                 'remove it with: delete from public.funds where is_sample;';
  end if;
end
$$;

insert into public.funds (
  name, share_class, isin, fund_manager, currency, category, risk_level,
  shariah_status, distribution_type, distribution_frequency,
  latest_nav, nav_date, description, is_sample, data_source
) values
  ('SAMPLE — Global Balanced Fund', 'Class A (Acc) SGD', 'SG0000SAMPLE1',
   'Sample Asset Management', 'SGD', 'Balanced', 'moderate',
   'conventional', 'accumulation', 'none',
   1.4820, current_date - 1,
   'Fictional balanced fund holding roughly sixty per cent equities and forty per cent bonds. Sample data for demonstration only.',
   true, 'manual'),

  ('SAMPLE — Global Balanced Fund', 'Class B (Dist) SGD', 'SG0000SAMPLE2',
   'Sample Asset Management', 'SGD', 'Balanced', 'moderate',
   'conventional', 'distribution', 'quarterly',
   1.1240, current_date - 1,
   'The distributing share class of the same fund. Deliberately included to show that share classes are separate records with different returns.',
   true, 'manual'),

  ('SAMPLE — Asia Pacific Equity Fund', 'Class A (Acc) SGD', 'SG0000SAMPLE3',
   'Sample Asset Management', 'SGD', 'Equity', 'high',
   'conventional', 'accumulation', 'none',
   2.7315, current_date - 1,
   'Fictional regional equity fund. Sample data for demonstration only.',
   true, 'manual'),

  ('SAMPLE — Shariah Global Equity Fund', 'Class A (Acc) SGD', 'SG0000SAMPLE4',
   'Sample Islamic Investments', 'SGD', 'Equity', 'moderately_high',
   'shariah', 'accumulation', 'none',
   1.9640, current_date - 1,
   'Fictional Shariah-compliant global equity fund. Sample data for demonstration only.',
   true, 'manual'),

  ('SAMPLE — Singapore Income Fund', 'Class A (Dist) SGD', 'SG0000SAMPLE5',
   'Sample Income Partners', 'SGD', 'Fixed Income', 'low',
   'conventional', 'distribution', 'monthly',
   0.9885, current_date - 1,
   'Fictional monthly-distributing income fund. Sample data for demonstration only.',
   true, 'manual'),

  ('SAMPLE — US Technology Fund', 'Class A (Acc) USD', 'US0000SAMPLE6',
   'Sample Growth Advisers', 'USD', 'Equity', 'very_high',
   'conventional', 'accumulation', 'none',
   34.5120, current_date - 1,
   'Fictional US-dollar fund, included to demonstrate that foreign NAVs are shown in their own currency and never summed into a client''s SGD portfolio.',
   true, 'manual'),

  ('SAMPLE — Conservative Bond Fund', 'Class A (Acc) SGD', 'SG0000SAMPLE7',
   'Sample Asset Management', 'SGD', 'Fixed Income', 'very_low',
   'conventional', 'accumulation', 'none',
   1.0745, current_date - 40,
   'Fictional bond fund whose NAV is deliberately dated forty days ago, so the stale-data indicator can be seen working.',
   true, 'manual'),

  ('SAMPLE — Emerging Markets Fund', 'Class A (Acc) SGD', 'SG0000SAMPLE8',
   'Sample Global Partners', 'SGD', 'Equity', 'very_high',
   'conventional', 'accumulation', 'none',
   null, null,
   'Fictional fund with no NAV recorded, so the "No NAV recorded" state can be seen working. It shows "Not available" rather than zero.',
   true, 'manual')
on conflict do nothing;

-- --- NAV history --------------------------------------------------------
-- Three years of month-end prices, generated with a gentle drift and a
-- little wobble so the charts look like something rather than a straight
-- line. Fictional, and obviously so.

-- Drift and volatility vary per fund, derived from the fund's own id, so
-- the sample set does not show eight funds with suspiciously identical
-- returns — which would look wrong to anyone demonstrating the product.
insert into public.fund_nav_history (fund_id, nav_date, nav, source)
select
  f.id,
  (date_trunc('month', current_date) - (n || ' months')::interval - interval '1 day')::date,
  greatest(round((
    f.latest_nav
    * (1 - drift.monthly_drift * n)
    * (1 + drift.wobble * sin(n::numeric * 1.7))
  )::numeric, 6), 0.000001),
  'manual'
from public.funds f
cross join lateral (
  select
    -- Between roughly 0.15% and 0.85% a month, i.e. 2% to 11% a year.
    0.0015 + (('x' || substr(md5(f.id::text), 1, 4))::bit(16)::int % 70) / 10000.0
      as monthly_drift,
    0.004 + (('x' || substr(md5(f.id::text), 5, 4))::bit(16)::int % 30) / 1000.0
      as wobble
) as drift
cross join generate_series(0, 35) as n
where f.is_sample
  and f.latest_nav is not null
on conflict (fund_id, nav_date) do nothing;

-- --- Allocations --------------------------------------------------------

insert into public.fund_allocations (fund_id, kind, label, weight, sort_order)
select f.id, a.kind::public.allocation_kind, a.label, a.weight, a.sort_order
from public.funds f
cross join (values
  ('asset_class', 'Equities',        0.58, 1),
  ('asset_class', 'Bonds',           0.34, 2),
  ('asset_class', 'Cash',            0.08, 3),
  ('region',      'North America',   0.42, 1),
  ('region',      'Asia ex-Japan',   0.26, 2),
  ('region',      'Europe',          0.20, 3),
  ('region',      'Other',           0.12, 4),
  ('top_holding', 'Sample Holding A', 0.052, 1),
  ('top_holding', 'Sample Holding B', 0.041, 2),
  ('top_holding', 'Sample Holding C', 0.038, 3),
  ('top_holding', 'Sample Holding D', 0.031, 4),
  ('top_holding', 'Sample Holding E', 0.029, 5)
) as a(kind, label, weight, sort_order)
where f.is_sample
  and f.name = 'SAMPLE — Global Balanced Fund'
on conflict do nothing;

-- --- Indicative FX ------------------------------------------------------

insert into public.currency_rates (currency_code, rate_to_sgd, rate_date, source)
values ('USD', 1.34500000, current_date - 1, 'manual')
on conflict (currency_code, rate_date) do nothing;

-- --- Recompute performance from the generated history -------------------
-- Done in SQL so the sample funds report performance the same way a real
-- fund does, rather than carrying hand-written numbers that do not match
-- their own chart.

update public.funds f
set perf_1y = sub.perf_1y
from (
  select
    h.fund_id,
    (max(h.nav) filter (where h.nav_date = latest.nav_date)
     / nullif(min(h.nav) filter (where h.nav_date = year_ago.nav_date), 0)) - 1 as perf_1y
  from public.fund_nav_history h
  join lateral (
    select nav_date from public.fund_nav_history
     where fund_id = h.fund_id order by nav_date desc limit 1
  ) latest on true
  join lateral (
    select nav_date from public.fund_nav_history
     where fund_id = h.fund_id
       and nav_date <= (select max(nav_date) - interval '1 year'
                          from public.fund_nav_history where fund_id = h.fund_id)
     order by nav_date desc limit 1
  ) year_ago on true
  group by h.fund_id
) as sub
where f.id = sub.fund_id and f.is_sample;
