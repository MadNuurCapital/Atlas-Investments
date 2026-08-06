-- =====================================================================
-- Atlas Investments — 0004 Saved calculations and portfolio scenarios
--
-- Saved work belongs to the advisor who made it. When it is attached to a
-- client it becomes client data, and the same ownership rule applies.
-- =====================================================================

create type public.calculator_type as enum (
  'projection',
  'target_contribution',
  'required_lump_sum',
  'retirement',
  'dividend_income',
  'hajj',
  'affordability'
);

create type public.assumption_mode as enum ('overall', 'per_fund');
create type public.distribution_mode as enum ('reinvest', 'payout');

-- ---------------------------------------------------------------------
-- saved_calculations
--
-- Inputs, outputs AND assumptions are all stored. Storing only the inputs
-- would mean reopening a saved plan next year silently recalculated it
-- against whatever the firm's default rates had become — so the figures an
-- advisor showed a client would change behind their back.
-- ---------------------------------------------------------------------

create table public.saved_calculations (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  client_id       uuid references public.clients (id) on delete cascade,
  calculator_type public.calculator_type not null,
  title           text not null check (length(trim(title)) > 0),
  inputs          jsonb not null,
  outputs         jsonb not null,
  assumptions     jsonb not null,
  -- Bumped when a formula changes, so an old result can be identified as
  -- having been produced by different maths.
  engine_version  text not null default '1.0',
  notes           text,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.saved_calculations.assumptions is
  'The scenario rates and conventions in force when this was calculated. '
  'Stored so reopening a plan reproduces exactly what the client was shown, '
  'rather than silently recalculating against today''s defaults.';

create index saved_calculations_owner_idx
  on public.saved_calculations (owner_id, created_at desc) where not is_archived;
create index saved_calculations_client_idx
  on public.saved_calculations (client_id, created_at desc) where client_id is not null;

-- ---------------------------------------------------------------------
-- portfolio_scenarios
-- ---------------------------------------------------------------------

create table public.portfolio_scenarios (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete cascade,
  client_id           uuid references public.clients (id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),

  assumption_mode     public.assumption_mode not null default 'overall',
  conservative_rate   numeric(9,6) not null default 0.03,
  moderate_rate       numeric(9,6) not null default 0.05,
  growth_rate         numeric(9,6) not null default 0.07,
  distribution_mode   public.distribution_mode not null default 'reinvest',

  initial_amount      numeric(14,2) not null default 0 check (initial_amount >= 0),
  monthly_contribution numeric(14,2) not null default 0 check (monthly_contribution >= 0),
  years               integer not null default 10 check (years > 0 and years <= 100),

  notes               text,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.portfolio_scenario_items (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references public.portfolio_scenarios (id) on delete cascade,
  fund_id      uuid not null references public.funds (id) on delete restrict,
  -- Decimal fraction, like every other rate here. 0.25 is a quarter.
  allocation   numeric(9,6) not null check (allocation >= 0 and allocation <= 1),
  -- Only used in per-fund assumption mode.
  assumed_rate numeric(9,6),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),

  unique (scenario_id, fund_id)
);

comment on table public.portfolio_scenario_items is
  'A fund and its allocation within a scenario. The four-to-eight fund limit '
  'and the exactly-100% rule are enforced in the application, because a '
  'scenario is legitimately incomplete while it is being built.';

create index portfolio_items_idx on public.portfolio_scenario_items (scenario_id, sort_order);

create trigger saved_calculations_updated_at before update on public.saved_calculations
  for each row execute function public.set_updated_at();
create trigger portfolio_scenarios_updated_at before update on public.portfolio_scenarios
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.saved_calculations       enable row level security;
alter table public.saved_calculations       force row level security;
alter table public.portfolio_scenarios      enable row level security;
alter table public.portfolio_scenarios      force row level security;
alter table public.portfolio_scenario_items enable row level security;
alter table public.portfolio_scenario_items force row level security;

/**
 * Two conditions, both required.
 *
 * You must own the saved work AND, if it is attached to a client, you must
 * own that client too. The second condition is not redundant: without it, a
 * saved calculation would keep leaking a client's figures to its author
 * after the client had been reassigned.
 */
create policy saved_calculations_own on public.saved_calculations for all to authenticated
  using (
    owner_id = (select auth.uid())
    and public.is_active_user()
    and (client_id is null or public.owns_client(client_id))
  )
  with check (
    owner_id = (select auth.uid())
    and public.is_active_user()
    and (client_id is null or public.owns_client(client_id))
  );

create policy portfolio_scenarios_own on public.portfolio_scenarios for all to authenticated
  using (
    owner_id = (select auth.uid())
    and public.is_active_user()
    and (client_id is null or public.owns_client(client_id))
  )
  with check (
    owner_id = (select auth.uid())
    and public.is_active_user()
    and (client_id is null or public.owns_client(client_id))
  );

create or replace function public.owns_scenario(target_scenario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.portfolio_scenarios s
     where s.id = target_scenario_id
       and s.owner_id = (select auth.uid())
       and public.is_active_user()
  );
$$;

revoke execute on function public.owns_scenario(uuid) from public, anon;
grant execute on function public.owns_scenario(uuid) to authenticated;

create policy portfolio_items_own on public.portfolio_scenario_items for all to authenticated
  using (public.owns_scenario(scenario_id))
  with check (public.owns_scenario(scenario_id));
