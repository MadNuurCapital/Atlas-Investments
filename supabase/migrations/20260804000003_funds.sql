-- =====================================================================
-- Atlas Investments — 0003 Fund Centre
--
-- Fund data is firm-wide reference data, not client data. Every active
-- user may read it; only an administrator may write it. That is the
-- mirror image of the client rules, and the two must not be confused:
-- an admin's power over funds grants nothing over anyone's clients.
-- =====================================================================

create type public.fund_risk_level as enum (
  'very_low', 'low', 'moderate', 'moderately_high', 'high', 'very_high'
);

create type public.shariah_status as enum ('shariah', 'conventional', 'unknown');

create type public.distribution_type as enum ('accumulation', 'distribution');

create type public.distribution_frequency as enum (
  'none', 'monthly', 'quarterly', 'semi_annual', 'annual', 'irregular'
);

create type public.fund_data_source as enum ('manual', 'csv', 'yahoo');

create type public.verification_status as enum ('unverified', 'verified', 'rejected');

create type public.refresh_status as enum ('success', 'partial', 'failed');

-- ---------------------------------------------------------------------
-- funds
-- ---------------------------------------------------------------------

create table public.funds (
  id                    uuid primary key default gen_random_uuid(),

  name                  text not null check (length(trim(name)) > 0),
  -- Share class is a separate column, never folded into the name.
  -- "Acc" and "Dist" classes of the same fund have genuinely different
  -- returns, and merging them would misreport a client's holding.
  share_class           text not null default '',
  isin                  text,

  fund_manager          text,
  currency              text not null default 'SGD' check (length(currency) = 3),
  category              text,
  risk_level            public.fund_risk_level,
  shariah_status        public.shariah_status not null default 'unknown',
  distribution_type     public.distribution_type not null default 'accumulation',
  distribution_frequency public.distribution_frequency not null default 'none',

  latest_nav            numeric(18,6) check (latest_nav >= 0),
  nav_date              date,

  -- Performance is stored as a decimal fraction (0.0523 = 5.23%), the same
  -- rule as every other rate in this database. NULL means "not available",
  -- which the interface must never render as 0%.
  perf_1m               numeric(12,6),
  perf_6m               numeric(12,6),
  perf_1y               numeric(12,6),
  perf_3y               numeric(12,6),
  perf_5y               numeric(12,6),
  perf_since_inception  numeric(12,6),
  inception_date        date,

  description           text,
  factsheet_url         text,

  -- --- Data source and verification ---------------------------------
  data_source           public.fund_data_source not null default 'manual',
  source_identifier     text,
  source_verified       boolean not null default false,
  source_verified_at    timestamptz,
  source_verified_by    uuid references public.profiles (id) on delete set null,
  auto_refresh_enabled  boolean not null default false,

  last_refresh_at       timestamptz,
  last_refresh_status   public.refresh_status,
  last_refresh_error    text,

  verification_status   public.verification_status not null default 'unverified',

  -- Seed data, so it can be told apart from real fund records and removed.
  is_sample             boolean not null default false,
  is_archived           boolean not null default false,
  archive_reason        text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Automatic refresh requires a verified symbol. Without this an admin
  -- could switch on auto-refresh against an unchecked symbol and silently
  -- track the wrong share class.
  constraint funds_auto_refresh_requires_verified_source
    check (
      not auto_refresh_enabled
      or (source_identifier is not null and source_verified)
    ),

  constraint funds_nav_requires_date
    check (latest_nav is null or nav_date is not null)
);

comment on table public.funds is
  'Approved master fund records. Readable by every active user, writable '
  'only by an administrator.';

comment on column public.funds.share_class is
  'Exact share class. Funds are never merged on similar names — different '
  'share classes of one fund have different returns.';

comment on column public.funds.auto_refresh_enabled is
  'Only ever true once an administrator has fetched the symbol, seen what '
  'came back, and confirmed it is the right share class.';

-- One record per fund and share class. A duplicate would let two holdings
-- of the same thing drift apart.
create unique index funds_name_share_class_key
  on public.funds (lower(name), lower(share_class)) where not is_archived;

create unique index funds_isin_key
  on public.funds (isin) where isin is not null and not is_archived;

create index funds_search_idx on public.funds (lower(name)) where not is_archived;
create index funds_refresh_idx on public.funds (auto_refresh_enabled, last_refresh_at)
  where auto_refresh_enabled;

-- Holdings may now reference a fund. Nullable: a holding can name its fund
-- as free text when the Fund Centre does not have it yet.
alter table public.client_holdings
  add constraint client_holdings_fund_fk
  foreign key (fund_id) references public.funds (id) on delete set null;

-- ---------------------------------------------------------------------
-- fund_allocations — asset class, region and top holdings in one table
-- ---------------------------------------------------------------------

create type public.allocation_kind as enum ('asset_class', 'region', 'top_holding');

create table public.fund_allocations (
  id           uuid primary key default gen_random_uuid(),
  fund_id      uuid not null references public.funds (id) on delete cascade,
  kind         public.allocation_kind not null,
  label        text not null check (length(trim(label)) > 0),
  -- Decimal fraction, consistent with every other rate here.
  weight       numeric(9,6) not null check (weight >= 0 and weight <= 1),
  as_of_date   date,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index fund_allocations_idx on public.fund_allocations (fund_id, kind, sort_order);

-- ---------------------------------------------------------------------
-- fund_nav_history
-- ---------------------------------------------------------------------

create table public.fund_nav_history (
  id          uuid primary key default gen_random_uuid(),
  fund_id     uuid not null references public.funds (id) on delete cascade,
  nav_date    date not null,
  nav         numeric(18,6) not null check (nav >= 0),
  source      public.fund_data_source not null default 'manual',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),

  unique (fund_id, nav_date)
);

comment on table public.fund_nav_history is
  'Dated NAV observations. Stored so charts never depend on a live external '
  'call, and so a failed refresh cannot blank a fund''s history.';

create index fund_nav_history_idx on public.fund_nav_history (fund_id, nav_date desc);

-- ---------------------------------------------------------------------
-- fund_refresh_runs
-- ---------------------------------------------------------------------

create table public.fund_refresh_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          public.refresh_status,
  funds_attempted integer not null default 0,
  funds_succeeded integer not null default 0,
  funds_failed    integer not null default 0,
  -- Per-fund outcomes, so a failure can be traced to the fund and message
  -- that caused it rather than a single unhelpful "refresh failed".
  details         jsonb not null default '[]'::jsonb,
  error_message   text,
  triggered_by    text not null default 'schedule'
);

create index fund_refresh_runs_idx on public.fund_refresh_runs (started_at desc);

-- ---------------------------------------------------------------------
-- fund_watchlists — private to each user
-- ---------------------------------------------------------------------

create table public.fund_watchlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  fund_id     uuid not null references public.funds (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, fund_id)
);

-- ---------------------------------------------------------------------
-- currency_rates
--
-- Indicative only. Used to show "≈ S$x" beside a foreign NAV so an advisor
-- has a sense of scale. NEVER enters a client portfolio total or any
-- calculator result — client money is SGD throughout.
-- ---------------------------------------------------------------------

create table public.currency_rates (
  id             uuid primary key default gen_random_uuid(),
  currency_code  text not null check (length(currency_code) = 3),
  rate_to_sgd    numeric(18,8) not null check (rate_to_sgd > 0),
  rate_date      date not null,
  source         public.fund_data_source not null default 'manual',
  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (currency_code, rate_date)
);

comment on table public.currency_rates is
  'Indicative FX for display beside foreign-currency NAVs. Never used in '
  'client portfolio arithmetic.';

-- ---------------------------------------------------------------------
-- csv_import_jobs
-- ---------------------------------------------------------------------

create table public.csv_import_jobs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles (id) on delete set null,
  target        text not null,
  fund_id       uuid references public.funds (id) on delete set null,
  filename      text,
  row_count     integer not null default 0,
  valid_count   integer not null default 0,
  error_count   integer not null default 0,
  errors        jsonb not null default '[]'::jsonb,
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- app_settings — admin-controlled defaults
-- ---------------------------------------------------------------------

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  ('scenario_rates',
   '{"conservative": 0.03, "moderate": 0.05, "growth": 0.07}'::jsonb,
   'Default annual return assumptions, as decimal fractions. Advisors may adjust them per calculation. Never derived from a fund''s past performance.'),
  ('nav_stale_after_days',
   '5'::jsonb,
   'A fund whose NAV is older than this many days is shown as stale.'),
  ('affordability_bands',
   '{"low": 0.10, "medium": 0.20, "high": 0.30}'::jsonb,
   'Proportions of monthly surplus used for the illustrative starting range.'),
  ('hajj_cost_default',
   '{"cost": 30000, "inflation": 0.05}'::jsonb,
   'Starting figures for the Hajj calculator, in SGD. Advisors may change both.');

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create trigger funds_updated_at before update on public.funds
  for each row execute function public.set_updated_at();

/**
 * A verified badge must never outlive the symbol it vouched for.
 *
 * Repointing a fund at a different symbol drops its verification, so an
 * admin cannot verify symbol A and then quietly switch to symbol B while
 * keeping the badge — exactly the mistake the verification step exists to
 * prevent.
 *
 * The `old.source_verified` condition matters: setting a symbol for the
 * first time and verifying it in the same statement is the normal flow, and
 * there is no previous verification to protect. Only a row that was ALREADY
 * verified can have its badge invalidated by a change.
 */
create or replace function public.reset_source_verification()
returns trigger
language plpgsql
as $$
begin
  if old.source_verified
     and new.source_identifier is distinct from old.source_identifier then
    new.source_verified := false;
    new.source_verified_at := null;
    new.source_verified_by := null;
    new.auto_refresh_enabled := false;
  end if;
  return new;
end;
$$;

create trigger funds_reset_verification
  before update on public.funds
  for each row execute function public.reset_source_verification();

-- ---------------------------------------------------------------------
-- Helper: is a fund's NAV stale?
-- ---------------------------------------------------------------------

create or replace function public.nav_stale_after_days()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value::text)::integer from public.app_settings
                    where key = 'nav_stale_after_days'), 5);
$$;

grant execute on function public.nav_stale_after_days() to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.funds              enable row level security;
alter table public.funds              force row level security;
alter table public.fund_allocations   enable row level security;
alter table public.fund_allocations   force row level security;
alter table public.fund_nav_history   enable row level security;
alter table public.fund_nav_history   force row level security;
alter table public.fund_refresh_runs  enable row level security;
alter table public.fund_refresh_runs  force row level security;
alter table public.fund_watchlists    enable row level security;
alter table public.fund_watchlists    force row level security;
alter table public.currency_rates     enable row level security;
alter table public.currency_rates     force row level security;
alter table public.csv_import_jobs    enable row level security;
alter table public.csv_import_jobs    force row level security;
alter table public.app_settings       enable row level security;
alter table public.app_settings       force row level security;

-- --- Reference data: everyone reads, only admins write ----------------

create policy funds_select_all on public.funds for select to authenticated
  using (public.is_active_user());
create policy funds_admin_write on public.funds for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy allocations_select_all on public.fund_allocations for select to authenticated
  using (public.is_active_user());
create policy allocations_admin_write on public.fund_allocations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy nav_select_all on public.fund_nav_history for select to authenticated
  using (public.is_active_user());
create policy nav_admin_write on public.fund_nav_history for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rates_select_all on public.currency_rates for select to authenticated
  using (public.is_active_user());
create policy rates_admin_write on public.currency_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy settings_select_all on public.app_settings for select to authenticated
  using (public.is_active_user());
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Admin-only operational data --------------------------------------

create policy refresh_runs_admin on public.fund_refresh_runs for select to authenticated
  using (public.is_admin());

create policy imports_admin on public.csv_import_jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --- Watchlists are private -------------------------------------------

create policy watchlist_own on public.fund_watchlists for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()) and public.is_active_user());
