import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";

// Browser client — used in Client Components for auth actions (sign in/out).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Admin client — SERVICE ROLE, bypasses RLS. Server-only. Never import this
// into a Client Component. Used for privileged operations where we still do
// our own authorization check first (e.g. verifying the caller is an admin).
export function createAdminClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
