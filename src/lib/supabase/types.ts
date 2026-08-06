/**
 * Database types.
 *
 * Hand-maintained to match the migrations. Once the Supabase project exists,
 * regenerate from the live schema so these can never drift:
 *
 *   npm run db:types
 *
 * The shape mirrors what `supabase gen types typescript` emits, so swapping
 * in the generated file is a straight replacement.
 *
 * Every row type is declared with `type`, never `interface`. Supabase's row
 * types must satisfy `Record<string, unknown>`, and an interface does not
 * receive an implicit index signature — using one makes every query resolve
 * to `never` with an error reported far from its cause.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "advisor" | "manager" | "admin";
export type ThemePreference = "light" | "dark" | "system";
export type ClientStatus = "active" | "archived";
export type HoldingStatus = "active" | "paused" | "matured" | "closed" | "lapsed";
export type TransactionType =
  | "additional_lump_sum"
  | "withdrawal"
  | "dividend"
  | "contribution_change"
  | "adjustment";
export type ReviewStatus = "draft" | "completed";
export type AuditScope = "client" | "system";
export type CalculatorType =
  | "projection"
  | "target_contribution"
  | "required_lump_sum"
  | "retirement"
  | "dividend_income"
  | "hajj"
  | "affordability";
export type AssumptionMode = "overall" | "per_fund";
export type DistributionMode = "reinvest" | "payout";

export type SavedCalculation = {
  id: string;
  owner_id: string;
  client_id: string | null;
  calculator_type: CalculatorType;
  title: string;
  inputs: Json;
  outputs: Json;
  assumptions: Json;
  engine_version: string;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PortfolioScenario = {
  id: string;
  owner_id: string;
  client_id: string | null;
  name: string;
  assumption_mode: AssumptionMode;
  conservative_rate: number;
  moderate_rate: number;
  growth_rate: number;
  distribution_mode: DistributionMode;
  initial_amount: number;
  monthly_contribution: number;
  years: number;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PortfolioScenarioItem = {
  id: string;
  scenario_id: string;
  fund_id: string;
  allocation: number;
  assumed_rate: number | null;
  sort_order: number;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  theme_preference: ThemePreference;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  advisor_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: ClientStatus;
  next_review_date: string | null;
  reminder_snoozed_until: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientHolding = {
  id: string;
  client_id: string;
  fund_id: string | null;
  fund_name_manual: string | null;
  provider: string;
  product_name: string;
  policy_reference: string | null;
  initial_lump_sum: number;
  monthly_contribution: number;
  start_date: string;
  current_value: number | null;
  current_value_as_of: string | null;
  investment_goal: string | null;
  status: HoldingStatus;
  contributions_ceased_on: string | null;
  contributed_override: number | null;
  contributed_override_reason: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type HoldingTransaction = {
  id: string;
  holding_id: string;
  type: TransactionType;
  amount: number | null;
  new_monthly_amount: number | null;
  effective_date: string;
  notes: string | null;
  review_id: string | null;
  created_by: string;
  created_at: string;
};

export type Review = {
  id: string;
  client_id: string;
  advisor_id: string;
  review_date: string;
  status: ReviewStatus;
  discussion_notes: string | null;
  goal_notes: string | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  next_review_date: string | null;
  completed_at: string | null;
  corrected_at: string | null;
  correction_count: number;
  created_at: string;
  updated_at: string;
};

export type ReviewHoldingSnapshot = {
  id: string;
  review_id: string;
  holding_id: string;
  provider: string;
  product_name: string;
  fund_display_name: string | null;
  status: HoldingStatus;
  monthly_contribution: number;
  total_contributed: number;
  current_value: number;
  withdrawals_to_date: number;
  dividends_to_date: number;
  gain_loss_amount: number;
  gain_loss_fraction: number | null;
  snapshot_at: string;
};

export type FundRiskLevel =
  | "very_low"
  | "low"
  | "moderate"
  | "moderately_high"
  | "high"
  | "very_high";
export type ShariahStatus = "shariah" | "conventional" | "unknown";
export type DistributionType = "accumulation" | "distribution";
export type DistributionFrequency =
  | "none"
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "irregular";
export type FundDataSource = "manual" | "csv" | "yahoo";
export type VerificationStatus = "unverified" | "verified" | "rejected";
export type RefreshStatus = "success" | "partial" | "failed";

/**
 * The performance periods a fund reports.
 *
 * The order here is the order they are shown in, shortest first, and the
 * database constrains `perf_manual_keys` to exactly this set — so a typo in
 * a key cannot silently fail to protect a figure.
 */
export const PERF_KEYS = [
  "ytd",
  "1m",
  "6m",
  "1y",
  "3y",
  "5y",
  "since_inception",
] as const;

export type PerfKey = (typeof PERF_KEYS)[number];
export type AllocationKind = "asset_class" | "region" | "top_holding";

export type Fund = {
  id: string;
  name: string;
  share_class: string;
  isin: string | null;
  fund_manager: string | null;
  currency: string;
  category: string | null;
  risk_level: FundRiskLevel | null;
  shariah_status: ShariahStatus;
  distribution_type: DistributionType;
  distribution_frequency: DistributionFrequency;
  latest_nav: number | null;
  nav_date: string | null;
  perf_ytd: number | null;
  perf_1m: number | null;
  perf_6m: number | null;
  perf_1y: number | null;
  perf_3y: number | null;
  perf_5y: number | null;
  perf_since_inception: number | null;
  /**
   * Which performance figures a person entered, so the scheduled refresh
   * leaves them alone. See migration 20260806000002 for why this exists.
   */
  perf_manual_keys: PerfKey[];
  inception_date: string | null;
  description: string | null;
  factsheet_url: string | null;
  data_source: FundDataSource;
  source_identifier: string | null;
  source_verified: boolean;
  source_verified_at: string | null;
  source_verified_by: string | null;
  auto_refresh_enabled: boolean;
  last_refresh_at: string | null;
  last_refresh_status: RefreshStatus | null;
  last_refresh_error: string | null;
  verification_status: VerificationStatus;
  is_sample: boolean;
  is_archived: boolean;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type FundAllocation = {
  id: string;
  fund_id: string;
  kind: AllocationKind;
  label: string;
  weight: number;
  as_of_date: string | null;
  sort_order: number;
  created_at: string;
};

export type FundNavPoint = {
  id: string;
  fund_id: string;
  nav_date: string;
  nav: number;
  source: FundDataSource;
  created_by: string | null;
  created_at: string;
};

export type FundRefreshRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: RefreshStatus | null;
  funds_attempted: number;
  funds_succeeded: number;
  funds_failed: number;
  details: Json;
  error_message: string | null;
  triggered_by: string;
};

export type FundWatchlistEntry = {
  id: string;
  user_id: string;
  fund_id: string;
  created_at: string;
};

export type CurrencyRate = {
  id: string;
  currency_code: string;
  rate_to_sgd: number;
  rate_date: string;
  source: FundDataSource;
  updated_by: string | null;
  created_at: string;
};

export type AppSetting = {
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  actor_id: string | null;
  scope: AuditScope;
  client_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  before: Json | null;
  after: Json | null;
  reason: string | null;
  created_at: string;
};

type Relationship<Column extends string, Target extends string> = {
  foreignKeyName: string;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ["id"];
};

/**
 * Relationships are not decoration. Supabase uses them to type nested
 * selects such as `clients(*, client_holdings(*))`. With an empty array
 * every nested query resolves to `SelectQueryError`, so each foreign key
 * the application actually traverses is declared below.
 */
type Table<Row, Insert, Update, Rels extends readonly unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        { id: string; email: string } & Partial<Profile>,
        Partial<Pick<Profile, "full_name" | "role" | "is_active" | "theme_preference">>
      >;
      clients: Table<
        Client,
        { advisor_id: string; full_name: string } & Partial<Client>,
        Partial<Client>,
        [Relationship<"advisor_id", "profiles">]
      >;
      client_holdings: Table<
        ClientHolding,
        {
          client_id: string;
          provider: string;
          product_name: string;
          start_date: string;
        } & Partial<ClientHolding>,
        Partial<ClientHolding>,
        [Relationship<"client_id", "clients">]
      >;
      holding_transactions: Table<
        HoldingTransaction,
        {
          holding_id: string;
          type: TransactionType;
          effective_date: string;
          created_by: string;
        } & Partial<HoldingTransaction>,
        Partial<HoldingTransaction>,
        [
          Relationship<"holding_id", "client_holdings">,
          Relationship<"review_id", "reviews">,
          Relationship<"created_by", "profiles">,
        ]
      >;
      reviews: Table<
        Review,
        {
          client_id: string;
          advisor_id: string;
          review_date: string;
        } & Partial<Review>,
        Partial<Review>,
        [Relationship<"client_id", "clients">, Relationship<"advisor_id", "profiles">]
      >;
      review_holding_snapshots: Table<
        ReviewHoldingSnapshot,
        Omit<ReviewHoldingSnapshot, "id" | "snapshot_at"> &
          Partial<Pick<ReviewHoldingSnapshot, "id" | "snapshot_at">>,
        never,
        [
          Relationship<"review_id", "reviews">,
          Relationship<"holding_id", "client_holdings">,
        ]
      >;
      audit_events: Table<
        AuditEvent,
        {
          scope: AuditScope;
          entity_type: string;
          action: string;
        } & Partial<AuditEvent>,
        never,
        [Relationship<"client_id", "clients">, Relationship<"actor_id", "profiles">]
      >;
      funds: Table<Fund, { name: string } & Partial<Fund>, Partial<Fund>, []>;
      fund_allocations: Table<
        FundAllocation,
        { fund_id: string; kind: AllocationKind; label: string; weight: number } & Partial<FundAllocation>,
        Partial<FundAllocation>,
        [Relationship<"fund_id", "funds">]
      >;
      fund_nav_history: Table<
        FundNavPoint,
        { fund_id: string; nav_date: string; nav: number } & Partial<FundNavPoint>,
        Partial<FundNavPoint>,
        [Relationship<"fund_id", "funds">]
      >;
      fund_refresh_runs: Table<
        FundRefreshRun,
        Partial<FundRefreshRun>,
        Partial<FundRefreshRun>,
        []
      >;
      fund_watchlists: Table<
        FundWatchlistEntry,
        { user_id: string; fund_id: string },
        never,
        [Relationship<"fund_id", "funds">, Relationship<"user_id", "profiles">]
      >;
      currency_rates: Table<
        CurrencyRate,
        { currency_code: string; rate_to_sgd: number; rate_date: string } & Partial<CurrencyRate>,
        Partial<CurrencyRate>,
        []
      >;
      app_settings: Table<
        AppSetting,
        { key: string; value: Json } & Partial<AppSetting>,
        Partial<AppSetting>,
        []
      >;
      saved_calculations: Table<
        SavedCalculation,
        {
          owner_id: string;
          calculator_type: CalculatorType;
          title: string;
          inputs: Json;
          outputs: Json;
          assumptions: Json;
        } & Partial<SavedCalculation>,
        Partial<SavedCalculation>,
        [Relationship<"owner_id", "profiles">, Relationship<"client_id", "clients">]
      >;
      portfolio_scenarios: Table<
        PortfolioScenario,
        { owner_id: string; name: string } & Partial<PortfolioScenario>,
        Partial<PortfolioScenario>,
        [Relationship<"owner_id", "profiles">, Relationship<"client_id", "clients">]
      >;
      portfolio_scenario_items: Table<
        PortfolioScenarioItem,
        { scenario_id: string; fund_id: string; allocation: number } & Partial<PortfolioScenarioItem>,
        Partial<PortfolioScenarioItem>,
        [Relationship<"scenario_id", "portfolio_scenarios">, Relationship<"fund_id", "funds">]
      >;
      csv_import_jobs: Table<
        {
          id: string;
          actor_id: string | null;
          target: string;
          fund_id: string | null;
          filename: string | null;
          row_count: number;
          valid_count: number;
          error_count: number;
          errors: Json;
          status: string;
          created_at: string;
        },
        { target: string } & Record<string, unknown>,
        Record<string, unknown>,
        [Relationship<"fund_id", "funds">]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      current_app_role: { Args: Record<PropertyKey, never>; Returns: AppRole };
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      owns_client: { Args: { target_client_id: string }; Returns: boolean };
      owns_holding: { Args: { target_holding_id: string }; Returns: boolean };
      owns_scenario: { Args: { target_scenario_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      theme_preference: ThemePreference;
      client_status: ClientStatus;
      holding_status: HoldingStatus;
      transaction_type: TransactionType;
      review_status: ReviewStatus;
      audit_scope: AuditScope;
      fund_risk_level: FundRiskLevel;
      shariah_status: ShariahStatus;
      distribution_type: DistributionType;
      distribution_frequency: DistributionFrequency;
      fund_data_source: FundDataSource;
      verification_status: VerificationStatus;
      refresh_status: RefreshStatus;
      allocation_kind: AllocationKind;
      calculator_type: CalculatorType;
      assumption_mode: AssumptionMode;
      distribution_mode: DistributionMode;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
