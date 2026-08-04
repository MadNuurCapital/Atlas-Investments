import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every emailed Supabase link — invitations, password
 * resets, email confirmations.
 *
 * Exchanges the one-time code in the URL for a real session cookie, then
 * forwards the user to wherever the link intended them to go.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Only ever redirect within this app — an attacker-supplied `next` must not
  // be able to forward a freshly authenticated user off-site.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link is invalid or has already been used.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link has expired. Please request a new one.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
