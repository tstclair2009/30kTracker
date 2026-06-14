import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Supabase redirects here after OAuth (or email confirmation). We exchange the
// one-time code for a session, and CRITICALLY attach the resulting auth cookies
// to the redirect response — otherwise the browser never receives the session
// and the user bounces straight back to the login page.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  // build the redirect response first, then let Supabase write cookies onto it
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return (
            request.headers
              .get("cookie")
              ?.split(";")
              .map((c) => {
                const [name, ...rest] = c.trim().split("=");
                return { name, value: rest.join("=") };
              }) ?? []
          );
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`
    );
  }
  return response;
}
