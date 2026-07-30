"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

// Landing page for the password-reset email. The link runs through
// /auth/callback (which exchanges the recovery code for a session), so by the
// time the user is here they are signed in and may simply set a new password.
export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    if (password !== confirm) return setErr("The passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="wrap">
      <section className="panel" style={{ maxWidth: 460, margin: "60px auto 0" }}>
        <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>CREDENTIAL RESET</div>
        <h1 className="section-title">SET A NEW PASSWORD</h1>

        {!checked ? (
          <p className="prose" style={{ marginBottom: 0 }}>Verifying your reset link…</p>
        ) : !signedIn ? (
          <p className="prose" style={{ marginBottom: 0 }}>
            This reset link is invalid or has expired.{" "}
            <Link href="/#enlist" style={{ color: "var(--gold-bright)" }}>
              Request a new one from the sign-in panel →
            </Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
            <div style={{ marginBottom: 12 }}>
              <label className="label">New password (min 6 characters)</label>
              <input
                className="input" type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Confirm new password</label>
              <input
                className="input" type="password" required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••"
              />
            </div>
            {err && <p style={{ color: "var(--crimson)", fontSize: 12 }}>⚠ {err}</p>}
            <button className="btn" type="submit" disabled={busy} style={{ width: "100%", marginTop: 4 }}>
              {busy ? "…" : "SET PASSWORD & RETURN TO THE WAR"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
