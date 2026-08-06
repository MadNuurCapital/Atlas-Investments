-- =====================================================================
-- Atlas Investments — 0006 Past performance: provenance, and year to date
--
-- Two changes, one cause.
--
-- PROBLEM. An administrator types past performance from a factsheet — the
-- only source for most Singapore-distributed funds — and the figures later
-- disappear. The scheduled refresh recomputes perf_1m … perf_5y from stored
-- NAV history and writes the result unconditionally. When there is not
-- enough history to compute a figure, `trailingReturn` correctly returns
-- NULL, and that NULL is written straight over the typed number.
--
-- So the more reliable the typed figure was — a five-year return on a fund
-- with three weeks of downloaded history — the more certain it was to be
-- destroyed. Nothing warned anyone, and the audit trail did not record it,
-- because from the database's point of view a refresh had simply succeeded.
--
-- FIX. Record which figures a human entered. The refresh then computes
-- everything as before but writes only the figures nobody has claimed. A
-- typed figure is authoritative until a human clears it: the firm's decision,
-- and the right one — a factsheet is a published document, while a derived
-- figure is only as good as the price history behind it.
--
-- Deliberately a text[] of keys rather than a boolean column per figure, so
-- adding a period later (as perf_ytd does below) needs no schema change.
--
-- Also adds perf_ytd. Year to date is the figure advisors are asked for most
-- in review meetings and it was missing.
-- =====================================================================

alter table public.funds
  add column if not exists perf_ytd numeric(12, 6),
  add column if not exists perf_manual_keys text[] not null default '{}';

comment on column public.funds.perf_ytd is
  'Year-to-date return as a decimal fraction (0.05 = 5%), consistent with '
  'every other rate in this database.';

comment on column public.funds.perf_manual_keys is
  'Which performance figures were entered by a person: any of ytd, 1m, 6m, '
  '1y, 3y, 5y, since_inception. The scheduled refresh must not overwrite '
  'these. Empty means every figure is derived and may be recomputed freely.';

-- Only the seven real periods may appear, so a typo in application code
-- cannot quietly protect a figure that does not exist — or, worse, fail to
-- protect one that does.
alter table public.funds
  drop constraint if exists funds_perf_manual_keys_valid;

alter table public.funds
  add constraint funds_perf_manual_keys_valid check (
    perf_manual_keys <@ array['ytd', '1m', '6m', '1y', '3y', '5y', 'since_inception']::text[]
  );

-- ---------------------------------------------------------------------
-- Existing rows
--
-- Every figure already in the table was typed by hand: the scheduled
-- refresh has never run against this database, and manual entry was the
-- only way a number could have got there. Claiming them protects the work
-- already done. A figure that is genuinely stale can be cleared, which
-- releases it back to the refresh.
-- ---------------------------------------------------------------------

update public.funds
set perf_manual_keys = (
  select coalesce(array_agg(key), '{}')
  from (
    select unnest(array['1m', '6m', '1y', '3y', '5y', 'since_inception']) as key,
           unnest(array[perf_1m, perf_6m, perf_1y, perf_3y, perf_5y, perf_since_inception]) as value
  ) as figures
  where value is not null
)
where perf_manual_keys = '{}';
