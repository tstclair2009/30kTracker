import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// Supabase redirects here after Google/Facebook sign-in. We exchange the
// one-time code for a session cookie, then send the user home.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
