import { z } from "zod";

/**
 * Environment validation.
 *
 * The app fails loudly at startup on a missing or malformed variable rather
 * than failing mysteriously at request time on a page nobody tested.
 *
 * The split below is a security boundary, not a style choice:
 *
 *   publicEnv  — NEXT_PUBLIC_*, compiled into the browser bundle. Safe to
 *                expose. The anon key belongs here; it carries no privilege
 *                of its own and is governed entirely by Row Level Security.
 *
 *   serverEnv  — never sent to the browser. Contains the service-role key,
 *                which bypasses RLS completely. Importing this module from a
 *                Client Component is a build error by design (see the
 *                server-only guard below).
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short to be valid"),
  NEXT_PUBLIC_SITE_URL: z.url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
});

/**
 * Referenced explicitly rather than via process.env[key] because Next inlines
 * NEXT_PUBLIC_* variables at build time by literal match. A dynamic lookup
 * would silently produce undefined in the browser.
 */
function readPublicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    throw new Error(
      "Invalid public environment variables:\n" +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n") +
        "\n\nCopy .env.example to .env.local and fill in the values.",
    );
  }

  return parsed.data;
}

export const publicEnv = readPublicEnv();
