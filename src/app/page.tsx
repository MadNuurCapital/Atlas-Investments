import { redirect } from "next/navigation";

/**
 * The root path is never really rendered — proxy.ts sends signed-in users to
 * /dashboard and everyone else to /login. This exists as the fallback for the
 * case where proxy is bypassed (for example a direct server render in tests).
 */
export default function RootPage() {
  redirect("/dashboard");
}
