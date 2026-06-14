import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client. Reads the user's session from cookies, so every
// query runs AS THAT USER and RLS policies apply. Use in Server Components,
// Server Actions, and route handlers.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component where setting cookies isn't allowed;
            // safe to ignore when middleware is refreshing the session.
          }
        },
      },
    }
  );
}
