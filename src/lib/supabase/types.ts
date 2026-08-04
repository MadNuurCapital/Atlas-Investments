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
    };
    Views: { [_ in never]: never };
    Functions: {
      current_app_role: { Args: Record<PropertyKey, never>; Returns: AppRole };
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      owns_client: { Args: { target_client_id: string }; Returns: boolean };
      owns_holding: { Args: { target_holding_id: string }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      theme_preference: ThemePreference;
      client_status: ClientStatus;
      holding_status: HoldingStatus;
      transaction_type: TransactionType;
      review_status: ReviewStatus;
      audit_scope: AuditScope;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
