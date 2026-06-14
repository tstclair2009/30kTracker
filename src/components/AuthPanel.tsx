"use client";

import { createClient } from "@/lib/supabase-client";

// Sign in with an OAuth provider. Supabase handles the redirect dance; we just
// point it back at our callback route.
export default function AuthPanel() {
  const supabase = createClient();

  async function signInWith(provider: "google" | "facebook") {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${site}/auth/callback` },
    });
  }

  return (
    <section className="panel">
      <h2 style={{ fontSize: 16, margin: "0 0 4px", color: "var(--bone)" }}>
        ENLIST IN THE WAR
      </h2>
      <p style={{ fontSize: 11, color: "var(--bone-dim)", lineHeight: 1.6, marginTop: 0 }}>
        Sign in to commit results to the ledger. Your identity is verified by your
        provider — no passwords stored here.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button className="btn" style={{ flex: "1 1 200px" }} onClick={() => signInWith("google")}>
          SIGN IN WITH GOOGLE
        </button>
        <button
          className="btn"
          style={{ flex: "1 1 200px", background: "var(--gold)" }}
          onClick={() => signInWith("facebook")}
        >
          SIGN IN WITH FACEBOOK
        </button>
      </div>
    </section>
  );
}
