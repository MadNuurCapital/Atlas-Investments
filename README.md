# Atlas Investments

Internal client-investment platform for **Integrated Barakah Wealth Advisory**.

Advisors track client investments, record quarterly reviews, research funds,
compare and combine them, run goal calculators, and produce simple
client-facing summaries — from one place.

> This is **not** a trading platform. There is no order execution, no
> brokerage, no intraday data, no buy/sell recommendations and no crypto.

**Status: Phase 1 of 5 complete** (foundation, authentication, security).
See [Build phases](#build-phases).

---

## The security model, in one sentence

**You can see your own clients and nobody else's, whatever your role.**

That includes administrators. An Admin manages users, funds, imports and
settings, and has **no ability whatsoever** to read another advisor's clients,
holdings, transactions, reviews, calculations or reports. This is enforced by
Row Level Security in PostgreSQL — not by hiding buttons — and is covered by
automated tests that fail the build if it ever stops being true.

An Admin who also advises clients keeps their own private client book, subject
to exactly the same rule.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

You will need a Supabase project. See [Supabase setup](#supabase-setup).

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build, **including the secret-leak check** |
| `npm run verify` | Typecheck + lint + unit tests. Run before every commit |
| `npm test` | Unit tests (Vitest) |
| `npm run test:rls` | Row Level Security tests against a real PostgreSQL |
| `npm run typecheck` | TypeScript, strict mode |
| `npm run lint` | ESLint |
| `npm run check:secrets` | Verify no server secret reached the browser bundle |
| `npm run db:types` | Regenerate database types from the live schema |

---

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Server Components keep client data on the server by default |
| Language | TypeScript, strict | Money code should not have implicit `any` in it |
| Styling | Tailwind CSS v4 | Design tokens in one file; no separate config to drift |
| Database | Supabase PostgreSQL | Row Level Security is the product's core requirement |
| Auth | Supabase Auth | Invite-only, email + password |
| Hosting | Netlify | |
| Tests | Vitest, psql, Playwright | Pure functions, database policies, and user journeys |

> Next.js 16 renamed the `middleware` convention to `proxy`, and `params`,
> `searchParams` and `cookies()` are async. Version-matched documentation ships
> inside `node_modules/next/dist/docs/` — read it there rather than relying on
> memory of older versions.

### Three independent layers of protection

Each is sufficient on its own. All three are present deliberately.

1. **`src/proxy.ts`** — an *optimistic* check. Refreshes the session cookie and
   redirects signed-out visitors. Fast, but a cookie proves nothing, so
   nothing security-critical rests on it.
2. **`src/lib/auth/dal.ts`** — the Data Access Layer, and the real gate. Calls
   `getUser()`, which revalidates the token with Supabase rather than trusting
   the cookie, then checks the profile is active.
3. **PostgreSQL Row Level Security** — the final word. Even a user who rewrote
   the entire frontend in their own browser cannot read a row the database
   will not give them.

### Where the keys live

| Variable | Exposure | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Carries no privilege; governed entirely by RLS |
| `NEXT_PUBLIC_SITE_URL` | Browser | Must match the real origin or emailed links break |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | **Bypasses all RLS.** See below |
| `FUND_REFRESH_SECRET` | **Server only** | Guards the scheduled refresh endpoint |

The service-role key is protected three ways:

- `src/lib/env.server.ts` imports `server-only`, so any Client Component that
  reaches it — directly or through a chain of imports — **fails the build**.
- `npm run build` then greps the emitted browser bundles for secret names,
  literal values, and anything shaped like a `service_role` JWT, and **fails
  the build** if it finds one.
- It is used in exactly two places: admin user management, and the scheduled
  fund refresh (fund tables only). It must **never** touch client data.

---

## Supabase setup

1. Create a project. Note the URL and the two keys from
   **Project Settings → API**.
2. Put them in `.env.local` (never commit it) and in Netlify's environment
   variables.
3. Apply migrations:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
4. **Turn off public sign-up** in **Authentication → Providers → Email**.
   `supabase/config.toml` sets this for local development; the hosted project
   is a separate setting and must be changed by hand.
5. Add the redirect URL under **Authentication → URL Configuration**:
   `https://<your-site>/auth/callback`
6. Create the first Admin. There is no sign-up page by design, so the first
   account is made in the dashboard: **Authentication → Users → Add user**,
   then set their role in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   From then on, every account is created by invitation from inside the app.

### Row Level Security

Every policy is defined in `supabase/migrations/` and commented there.
Migration `20260804000001_foundation.sql` establishes:

| Rule | Enforced by |
| --- | --- |
| Only active users can read anything | `is_active_user()`, checked in every policy |
| You read your own profile; Admin reads all profiles | `profiles_select_*` policies |
| Nobody can change their own role or active status | `protect_profile_fields()` trigger |
| An Admin cannot demote or deactivate **themselves** | same trigger — prevents locking everyone out |
| A deactivated Admin loses admin powers immediately | `is_admin()` checks `is_active` too |
| Profiles are never deleted, only deactivated | `DELETE` revoked |
| Accounts are created by invitation only | no `INSERT` policy; `handle_new_user()` trigger |

Helper functions are `SECURITY DEFINER` with `search_path = ''`. Both matter:
the first prevents infinite recursion when a policy on `profiles` needs to
query `profiles`; the second stops an object planted in another schema from
shadowing the ones the function relies on.

### Running the security tests

The suite rebuilds a database from scratch — shim, then every migration in
order, then the assertions. If the migrations cannot build a clean database,
it fails, which is exactly the guarantee wanted before a deploy.

```bash
supabase start                 # or any PostgreSQL you can reach
PGPORT=54322 npm run test:rls
```

`supabase/tests/harness/` recreates the parts of Supabase a plain PostgreSQL
lacks (the `auth` schema, `auth.uid()`, `auth.role()`, the three roles). It
lives outside `supabase/migrations/` and **is never applied to a real
database**.

Current coverage: **22 assertions, all passing** — including that an advisor
cannot promote themselves, cannot read another advisor's profile, cannot
insert or delete profiles, and that an admin cannot lock themselves out.

---

## Deployment (Netlify)

1. Connect the repository. `netlify.toml` supplies the build command, the
   Next.js runtime plugin and the security headers.
2. Set all five environment variables from `.env.example`. Set
   `NEXT_PUBLIC_SITE_URL` to the real deployed origin — password-reset and
   invitation emails build their links from it.
3. Deploy. The build fails if a server secret reaches the browser bundle.

Headers applied to every response: `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
HSTS, and `X-Robots-Tag: noindex` — this holds client financial data and must
never be indexed or embedded.

---

## Build phases

| Phase | Contents | Status |
| --- | --- | --- |
| **1 — Foundation** | Repo, env validation, design tokens, themes, migrations, auth, invitations, profiles, roles, RLS foundation, app shell | ✅ **Complete** |
| **2 — Clients and Reviews** | Client records, holdings, transactions, dividends, quarterly reviews, immutable snapshots, reminders | Next |
| **3 — Fund Centre** | Admin fund management, NAV history, paste/CSV import, Yahoo adapter, symbol verification, scheduled refresh, watchlists, Data Health | Planned |
| **4 — Calculators and Portfolio Builder** | Pure calculation library and tests, seven calculators, save-to-client, 3-fund comparison, 4–8 fund portfolio builder | Planned |
| **5 — Reports and Hardening** | Client Snapshot, PDF, audit trail, error states, end-to-end tests, seed data, production checklist | Planned |

Screens that are not built say so plainly. They do **not** show sample charts
or invented figures — placeholder analytics in a system holding real client
money teach people to distrust every number on screen.

---

## Conventions

- **Money** is `numeric` in PostgreSQL, never floating point. `0.1 + 0.2` is
  not `0.3` in binary floating point, and that is unacceptable on a client's
  portfolio.
- **Rates and percentages** are stored as decimal fractions (`0.05` = 5%).
  One rule, no exceptions. Conversion to a percentage happens only in
  `src/lib/format.ts`.
- **Missing data reads "Not available"**, never `0` or `0%`. Zero is a real
  answer; showing one where there is no data is a lie an advisor could repeat
  to a client.
- **SGD renders as `S$`**, applied by hand. In the `en-SG` locale, `Intl`
  formats SGD as a bare `$`, indistinguishable from US dollars.
- **Timestamps** are `timestamptz`; presentation is Asia/Singapore.
- **Brand gold and warning amber are different colours** and must stay that
  way. If "Atlas" and "something is wrong" look identical, the interface stops
  communicating.
- **Archive, never delete.**

---

## Known limitations

1. **Fund coverage is unproven.** Yahoo Finance's coverage of
   Singapore-distributed insurer-linked funds and non-US share classes is
   patchy. The real hit rate is unknown until tested against the firm's actual
   fund list. Funds it misses are entered manually and work fully.
2. **Yahoo data is not licensed for commercial redistribution.** Suitable for
   a prototype and internal use; showing it in client-facing PDFs is a
   compliance decision for the firm. The adapter is deliberately replaceable.
   **This requires business sign-off before production use.**
3. **No idle session timeout** (a deliberate decision). An unattended
   logged-in laptop is an exposed client book. Consider a device screen-lock
   policy.
4. **Gain/loss is deliberately simple** and does not account for the timing of
   cash flows. It is labelled "Simple gain/loss" throughout. It is not
   time-weighted return and not XIRR, and the application never claims it is.
5. **The logo is a reproduction** pending the official vector file. See
   `public/brand/README.md`.

---

## Items needing real credentials or business approval

- Supabase project, keys, and the first Admin account
- Netlify site and environment variables
- The official Atlas / IBW logo files
- The firm's real fund list, with exact share classes
- **Compliance sign-off on fund data licensing** (limitation 2 above)
