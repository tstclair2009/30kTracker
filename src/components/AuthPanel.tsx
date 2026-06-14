"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export default function AuthPanel() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);

  async function signInWith(provider: "google" | "facebook") {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${site}/auth/callback` },
    });
  }

  async function onEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
        },
      });
      setBusy(false);
      if (error) return setMsg({ error: error.message });
      // If email confirmation is ON, there's no session yet.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.refresh();
      } else {
        setMsg({ ok: "Check your email to confirm your account, then sign in." });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg({ error: error.message });
      router.refresh();
    }
  }

  return (
    <section className="panel">
      <h2 style={{ fontSize: 16, margin: "0 0 4px", color: "var(--bone)" }}>
        {mode === "register" ? "ENLIST IN THE WAR" : "RESUME YOUR CAMPAIGN"}
      </h2>
      <p style={{ fontSize: 11, color: "var(--bone-dim)", lineHeight: 1.6, marginTop: 0 }}>
        Sign in to commit results to the ledger.
      </p>

      {/* SSO */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button className="btn" style={{ flex: "1 1 200px" }} onClick={() => signInWith("google")}>
          CONTINUE WITH GOOGLE
        </button>
        <button
          className="btn"
          style={{ flex: "1 1 200px", background: "var(--gold)" }}
          onClick={() => signInWith("facebook")}
        >
          CONTINUE WITH FACEBOOK
        </button>
      </div>

      {/* divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
        <div style={{ flex: 1, height: 1, background: "var(--panel-edge)" }} />
        <span style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.15em" }}>OR WITH EMAIL</span>
        <div style={{ flex: 1, height: 1, background: "var(--panel-edge)" }} />
      </div>

      {/* email/password */}
      <form onSubmit={onEmailAuth}>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="remembrancer@terra.imp"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="label">Password {mode === "register" ? "(min 6 characters)" : ""}</label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {msg?.error && <p style={{ color: "var(--crimson)", fontSize: 12 }}>⚠ {msg.error}</p>}
        {msg?.ok && <p style={{ color: "var(--gold)", fontSize: 12 }}>✓ {msg.ok}</p>}

        <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 4 }}>
          {busy ? "…" : mode === "register" ? "ENLIST" : "SIGN IN"}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === "register" ? "signin" : "register"); setMsg(null); }}
        style={{
          marginTop: 12, width: "100%", background: "transparent", border: "none",
          color: "var(--bone-dim)", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, letterSpacing: "0.1em", cursor: "pointer",
        }}
      >
        {mode === "register" ? "Already enlisted? Sign in →" : "New to the war? Enlist with email →"}
      </button>
    </section>
  );
}
