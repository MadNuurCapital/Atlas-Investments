#!/usr/bin/env node
/**
 * Build-time guard: fail the build if a server secret reached the browser.
 *
 * The `server-only` package already makes importing server code from a Client
 * Component a compile error. This is the belt-and-braces check that inspects
 * what actually got emitted, because the cost of being wrong here is every
 * client record in the database.
 *
 * Runs automatically after `npm run build`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_BUNDLE_DIRS = [".next/static"];

/** Names that must never appear in browser output. */
const FORBIDDEN_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "FUND_REFRESH_SECRET"];

/** Actual values from the environment, if the build had them available. */
const FORBIDDEN_VALUES = FORBIDDEN_NAMES.map((name) => process.env[name]).filter(
  (value) => typeof value === "string" && value.length >= 16,
);

/** A Supabase service-role JWT identifies itself in its payload. */
const SERVICE_ROLE_JWT = /"role"\s*:\s*"service_role"|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(js|mjs|cjs|json|txt|map)$/.test(entry)) out.push(full);
  }
  return out;
}

const failures = [];

for (const dir of CLIENT_BUNDLE_DIRS) {
  for (const file of walk(dir)) {
    const contents = readFileSync(file, "utf8");

    for (const name of FORBIDDEN_NAMES) {
      if (contents.includes(name)) {
        failures.push(`${file}: references ${name}`);
      }
    }
    for (const value of FORBIDDEN_VALUES) {
      if (contents.includes(value)) {
        failures.push(`${file}: contains the literal value of a server secret`);
      }
    }
    if (SERVICE_ROLE_JWT.test(contents)) {
      failures.push(`${file}: looks like it contains a service_role JWT`);
    }
  }
}

if (failures.length > 0) {
  console.error("\n[31m✖ SECURITY CHECK FAILED[0m");
  console.error("  A server-only secret reached the browser bundle:\n");
  for (const failure of [...new Set(failures)]) console.error(`    - ${failure}`);
  console.error(
    "\n  Do not deploy this build. Find the Client Component importing server\n" +
      "  code, and rotate the affected key in Supabase if it was ever published.\n",
  );
  process.exit(1);
}

console.log("[32m✓[0m No server secrets found in the browser bundle.");
