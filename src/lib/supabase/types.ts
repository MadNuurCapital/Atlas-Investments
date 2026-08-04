/**
 * Database types.
 *
 * Hand-maintained for now, matching migration 0001. Once the Supabase project
 * exists, regenerate from the live schema so these can never drift from the
 * migrations:
 *
 *   npm run db:types
 *
 * The shape below mirrors what `supabase gen types typescript` emits, so
 * swapping in the generated file is a straight replacement.
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

/**
 * Declared as a type alias, not an interface, and this matters.
 * Supabase's row types must satisfy `Record<string, unknown>`. Interfaces do
 * not receive an implicit index signature, so an interface here makes every
 * query resolve to `never` with a confusing error far from the cause.
 */
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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          role?: AppRole;
          is_active?: boolean;
          theme_preference?: ThemePreference;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          role?: AppRole;
          is_active?: boolean;
          theme_preference?: ThemePreference;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_app_role: { Args: Record<PropertyKey, never>; Returns: AppRole };
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      theme_preference: ThemePreference;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
