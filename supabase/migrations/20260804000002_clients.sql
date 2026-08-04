-- =====================================================================
-- Atlas Investments — 0002 Clients, holdings, transactions, reviews
--
-- Every table here is client-scoped, which means one rule governs all of
-- them: you can reach a row only if you are the active advisor who owns
-- the client it belongs to. No role overrides this. Not manager, not
-- admin, not the person who installed the database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------

create type public.client_status as enum ('active', 'archived');

create type public.holding_status as enum (
  'active',    -- contributing and invested
  'paused',    -- contributions stopped, money still invested
  'matured',   -- reached its natural end
  'closed',    -- surrendered or fully withdrawn
  'lapsed'     -- policy lapsed, typically non-payment
);

create type public.transaction_type as enum (
  'additional_lump_sum',
  'withdrawal',
  'dividend',
  'contribution_change',
  'adjustment'
);

create type public.review_status as enum ('draft', 'completed');

create type public.audit_scope as enum ('client', 'system');

-- ---------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------

create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  advisor_id            uuid not null references public.profiles (id) on delete restrict,
  full_name             text not null check (length(trim(full_name)) > 0),
  email                 text,
  phone                 text,
  notes                 text,
  status                public.client_status not null default 'active',
  next_review_date      date,
  reminder_snoozed_until date,
  archived_at           timestamptz,
  archive_reason        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Archiving always carries a reason. "Why is this client archived?" is a
  -- question someone will ask a year from now.
  constraint clients_archive_reason_required
    check (status <> 'archived' or (archived_at is not null and archive_reason is not null))
);

comment on table public.clients is
  'Advisor-owned client record. Deliberately minimal: no NRIC, no bank '
  'details, no provider credentials, no uploaded documents.';

comment on column public.clients.notes is
  'Internal advisor notes. NEVER included in any client-facing output.';

comment on column public.clients.reminder_snoozed_until is
  'Quietens a review reminder until this date. An overdue review still '
  'counts in the overdue total — snoozing lowers the volume, it cannot '
  'make the obligation disappear.';

create index clients_advisor_idx on public.clients (advisor_id) where status = 'active';
create index clients_next_review_idx on public.clients (advisor_id, next_review_date)
  where status = 'active';

-- ---------------------------------------------------------------------
-- client_holdings
-- ---------------------------------------------------------------------

create table public.client_holdings (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.clients (id) on delete restrict,

  -- A holding either links to an approved Fund Centre record or names its
  -- fund as free text. Both are legitimate: advisors hold clients in
  -- obscure insurer sub-funds that will not be in the Fund Centre on day
  -- one, and blocking data entry until an admin adds them would make the
  -- product unusable. The foreign key is added in migration 0003, once the
  -- funds table exists.
  fund_id                  uuid,
  fund_name_manual         text,

  provider                 text not null check (length(trim(provider)) > 0),
  product_name             text not null check (length(trim(product_name)) > 0),
  policy_reference         text,

  initial_lump_sum         numeric(14,2) not null default 0 check (initial_lump_sum >= 0),
  monthly_contribution     numeric(14,2) not null default 0 check (monthly_contribution >= 0),
  start_date               date not null,

  current_value            numeric(14,2) check (current_value >= 0),
  current_value_as_of      date,

  investment_goal          text,
  status                   public.holding_status not null default 'active',

  -- Set when contributions stop, so accrual knows where to end. Required
  -- for any status other than active.
  contributions_ceased_on  date,

  -- Escape hatch for when a provider statement disagrees with the figure
  -- Atlas derives. Always accompanied by a reason and flagged in the UI.
  contributed_override     numeric(14,2) check (contributed_override >= 0),
  contributed_override_reason text,

  archived_at              timestamptz,
  archive_reason           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint holdings_fund_identified
    check (fund_id is not null or nullif(trim(coalesce(fund_name_manual, '')), '') is not null),

  constraint holdings_ceased_date_required
    check (status = 'active' or contributions_ceased_on is not null),

  constraint holdings_override_reason_required
    check (contributed_override is null or contributed_override_reason is not null),

  constraint holdings_value_date_required
    check (current_value is null or current_value_as_of is not null)
);

comment on table public.client_holdings is
  'One investment product held by one client. A client may hold many.';

comment on column public.client_holdings.contributions_ceased_on is
  'The date recurring contributions stopped. Contribution accrual ends '
  'here, which is what makes a paused holding contribute zero to the '
  'monthly total while keeping its current value.';

create index holdings_client_idx on public.client_holdings (client_id)
  where archived_at is null;

-- ---------------------------------------------------------------------
-- holding_transactions
-- ---------------------------------------------------------------------

create table public.holding_transactions (
  id                  uuid primary key default gen_random_uuid(),
  holding_id          uuid not null references public.client_holdings (id) on delete restrict,
  type                public.transaction_type not null,

  -- Used by every type except contribution_change.
  amount              numeric(14,2) check (amount >= 0),
  -- Used only by contribution_change: the new monthly figure from this date.
  new_monthly_amount  numeric(14,2) check (new_monthly_amount >= 0),

  effective_date      date not null,
  notes               text,
  -- The review that recorded this, when it came out of a review session.
  review_id           uuid,
  created_by          uuid not null references public.profiles (id) on delete restrict,
  created_at          timestamptz not null default now(),

  constraint transactions_amount_matches_type check (
    case type
      when 'contribution_change' then new_monthly_amount is not null and amount is null
      else amount is not null and new_monthly_amount is null
    end
  )
);

comment on table public.holding_transactions is
  'Every movement on a holding: additional lump sums, withdrawals, cash '
  'dividends and distributions, and changes to the monthly contribution.';

create index transactions_holding_idx
  on public.holding_transactions (holding_id, effective_date);

-- ---------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------

create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients (id) on delete restrict,
  advisor_id          uuid not null references public.profiles (id) on delete restrict,
  review_date         date not null,
  status              public.review_status not null default 'draft',

  discussion_notes    text,
  goal_notes          text,
  follow_up_required  boolean not null default false,
  follow_up_notes     text,

  next_review_date    date,
  completed_at        timestamptz,
  corrected_at        timestamptz,
  correction_count    integer not null default 0 check (correction_count >= 0),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint reviews_completed_fields
    check (status <> 'completed' or (completed_at is not null and next_review_date is not null))
);

comment on table public.reviews is
  'A quarterly review session. Completing one captures an immutable '
  'snapshot of every holding and sets the next review date.';

comment on column public.reviews.correction_count is
  'A completed review stays editable, because one mistyped current value '
  'would otherwise corrupt a client''s value history permanently. Every '
  'correction increments this, records a reason in audit_events, and shows '
  'as "Corrected" in the interface.';

-- Only one review may be open per client at a time. Two half-finished
-- reviews of the same client is a data-integrity problem, not a feature.
create unique index reviews_one_draft_per_client
  on public.reviews (client_id) where status = 'draft';

create index reviews_client_idx on public.reviews (client_id, review_date desc);

alter table public.holding_transactions
  add constraint holding_transactions_review_fk
  foreign key (review_id) references public.reviews (id) on delete set null;

-- ---------------------------------------------------------------------
-- review_holding_snapshots
--
-- What the advisor and client actually saw at that moment, frozen. These
-- are stored rather than recomputed on purpose: recalculating history from
-- today's data would silently rewrite what a client was told last quarter.
-- ---------------------------------------------------------------------

create table public.review_holding_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  review_id             uuid not null references public.reviews (id) on delete cascade,
  holding_id            uuid not null references public.client_holdings (id) on delete restrict,

  provider              text not null,
  product_name          text not null,
  fund_display_name     text,
  status                public.holding_status not null,

  monthly_contribution  numeric(14,2) not null,
  total_contributed     numeric(14,2) not null,
  current_value         numeric(14,2) not null,
  withdrawals_to_date   numeric(14,2) not null default 0,
  dividends_to_date     numeric(14,2) not null default 0,

  gain_loss_amount      numeric(14,2) not null,
  -- Null, never zero, when there are no contributions to measure against.
  -- A zero here would read as "no gain", which is a different claim.
  gain_loss_fraction    numeric(12,6),

  snapshot_at           timestamptz not null default now(),

  unique (review_id, holding_id)
);

create index snapshots_holding_idx
  on public.review_holding_snapshots (holding_id, snapshot_at);

-- ---------------------------------------------------------------------
-- audit_events
--
-- Scope is a security boundary, not a label.
--
--   'client' — value changes, contributions, withdrawals, dividends,
--              review corrections. Readable ONLY by the owning advisor.
--              An admin cannot read these, because an audit log of
--              "current value changed on client Siti Rahman" IS client
--              data, and letting admins read it would be a back door
--              around the entire privacy model.
--
--   'system' — users, roles, funds, settings, imports. Admin-readable.
-- ---------------------------------------------------------------------

create table public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles (id) on delete set null,
  scope        public.audit_scope not null,
  client_id    uuid references public.clients (id) on delete cascade,
  entity_type  text not null,
  entity_id    uuid,
  action       text not null,
  before       jsonb,
  after        jsonb,
  reason       text,
  created_at   timestamptz not null default now(),

  constraint audit_client_scope_has_client
    check (scope <> 'client' or client_id is not null)
);

create index audit_client_idx on public.audit_events (client_id, created_at desc)
  where scope = 'client';
create index audit_system_idx on public.audit_events (created_at desc)
  where scope = 'system';

-- ---------------------------------------------------------------------
-- Ownership helper
--
-- SECURITY DEFINER so it can consult clients without re-entering the
-- policy that called it. This single function is what every client-scoped
-- policy below delegates to, so the ownership rule is written once.
-- ---------------------------------------------------------------------

create or replace function public.owns_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
     and exists (
       select 1 from public.clients c
        where c.id = target_client_id
          and c.advisor_id = (select auth.uid())
     );
$$;

comment on function public.owns_client(uuid) is
  'The one ownership rule, written once. No role bypasses it.';

create or replace function public.owns_holding(target_holding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.client_holdings h
     where h.id = target_holding_id
       and public.owns_client(h.client_id)
  );
$$;

revoke execute on function public.owns_client(uuid) from public, anon;
revoke execute on function public.owns_holding(uuid) from public, anon;
grant execute on function public.owns_client(uuid) to authenticated;
grant execute on function public.owns_holding(uuid) to authenticated;

-- updated_at maintenance
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger holdings_updated_at before update on public.client_holdings
  for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Snapshots are immutable
--
-- The review that produced them can be corrected; the snapshot rows
-- themselves are replaced wholesale by that process, never edited in
-- place. An UPDATE against a snapshot means something has gone wrong.
-- ---------------------------------------------------------------------

create or replace function public.reject_snapshot_update()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Review snapshots are immutable. Correct the review instead, which '
    'replaces its snapshots and records the change.'
    using errcode = '42501';
end;
$$;

create trigger snapshots_immutable
  before update on public.review_holding_snapshots
  for each row execute function public.reject_snapshot_update();

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.clients                  enable row level security;
alter table public.clients                  force row level security;
alter table public.client_holdings          enable row level security;
alter table public.client_holdings          force row level security;
alter table public.holding_transactions     enable row level security;
alter table public.holding_transactions     force row level security;
alter table public.reviews                  enable row level security;
alter table public.reviews                  force row level security;
alter table public.review_holding_snapshots enable row level security;
alter table public.review_holding_snapshots force row level security;
alter table public.audit_events             enable row level security;
alter table public.audit_events             force row level security;

-- --- clients ----------------------------------------------------------

create policy clients_select_own on public.clients for select to authenticated
  using (advisor_id = (select auth.uid()) and public.is_active_user());

create policy clients_insert_own on public.clients for insert to authenticated
  with check (advisor_id = (select auth.uid()) and public.is_active_user());

create policy clients_update_own on public.clients for update to authenticated
  using (advisor_id = (select auth.uid()) and public.is_active_user())
  with check (advisor_id = (select auth.uid()));

-- --- client_holdings --------------------------------------------------

create policy holdings_select_own on public.client_holdings for select to authenticated
  using (public.owns_client(client_id));

create policy holdings_insert_own on public.client_holdings for insert to authenticated
  with check (public.owns_client(client_id));

create policy holdings_update_own on public.client_holdings for update to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

-- --- holding_transactions ---------------------------------------------

create policy transactions_select_own on public.holding_transactions for select to authenticated
  using (public.owns_holding(holding_id));

create policy transactions_insert_own on public.holding_transactions for insert to authenticated
  with check (public.owns_holding(holding_id) and created_by = (select auth.uid()));

create policy transactions_update_own on public.holding_transactions for update to authenticated
  using (public.owns_holding(holding_id))
  with check (public.owns_holding(holding_id));

create policy transactions_delete_own on public.holding_transactions for delete to authenticated
  using (public.owns_holding(holding_id));

-- --- reviews ----------------------------------------------------------

create policy reviews_select_own on public.reviews for select to authenticated
  using (public.owns_client(client_id));

create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (public.owns_client(client_id) and advisor_id = (select auth.uid()));

create policy reviews_update_own on public.reviews for update to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

-- --- review_holding_snapshots -----------------------------------------

create policy snapshots_select_own on public.review_holding_snapshots for select to authenticated
  using (public.owns_holding(holding_id));

create policy snapshots_insert_own on public.review_holding_snapshots for insert to authenticated
  with check (public.owns_holding(holding_id));

-- Corrections replace a review's snapshots wholesale.
create policy snapshots_delete_own on public.review_holding_snapshots for delete to authenticated
  using (public.owns_holding(holding_id));

-- --- audit_events -----------------------------------------------------

-- An advisor reads the audit trail for their own clients.
create policy audit_select_own_clients on public.audit_events for select to authenticated
  using (scope = 'client' and public.owns_client(client_id));

-- An admin reads system events ONLY. Note there is deliberately no policy
-- granting an admin access to client-scope rows.
create policy audit_select_system_admin on public.audit_events for select to authenticated
  using (scope = 'system' and public.is_admin());

create policy audit_insert_client on public.audit_events for insert to authenticated
  with check (
    scope = 'client'
    and public.owns_client(client_id)
    and actor_id = (select auth.uid())
  );

-- Audit rows are never edited or deleted by anyone. That is the point.
revoke update, delete on public.audit_events from authenticated, anon;

-- Client records are archived, never deleted, so their history survives.
revoke delete on public.clients from authenticated, anon;
revoke delete on public.client_holdings from authenticated, anon;
revoke delete on public.reviews from authenticated, anon;
