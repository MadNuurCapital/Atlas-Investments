import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Proxy — Next.js 16's replacement for the old `middleware` convention.
 *
 * Two jobs, both deliberately narrow:
 *
 *   1. Refresh the Supabase session cookie so a working session does not
 *      expire mid-task while an advisor is part-way through a review.
 *   2. An OPTIMISTIC redirect: bounce requests with no session away from the
 *      app, and requests with a session away from the login page.
 *
 * What this file must NOT do is decide who may see what. It runs on every
 * request including prefetches, and a cookie is not proof of anything. Real
 * authorisation happens in the Data Access Layer (`src/lib/auth/dal.ts`) and
 * ultimately in Postgres Row Level Security. Removing this file entirely
 * would cost speed and polish, not safety.
 */

const PUBLIC_ROUTES = [
  "/login",
  "/reset-password",
  "/update-password",
  "/accept-invite",
  "/account-inactive",
  "/auth/callback",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the token and rewrites the cookie if it was close to expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were heading so login can return them there.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Excluding static assets matters: without it this runs on every CSS, JS
  // and image request, and the auth redirect would block them from loading.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
