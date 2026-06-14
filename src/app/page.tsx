import { getWarBalance, getRecentBattles, getCurrentProfile } from "@/lib/data";
import AuthPanel from "@/components/AuthPanel";
import SubmitForm from "@/components/SubmitForm";
import { signOut } from "@/app/actions";
import EditHandle from "@/components/EditHandle";
import Link from "next/link";

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "moments ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

export default async function Home() {
  const [balance, recent, profile] = await Promise.all([
    getWarBalance(),
    getRecentBattles(20),
    getCurrentProfile(),
  ]);

  const loyal = balance.loyalist_vp;
  const traitor = balance.traitor_vp;
  const diff = loyal - traitor;
  const marker = 50 + 50 * (diff / (Math.abs(diff) + 150)); // compressed, never pinned

  return (
    <main className="wrap">
      <header style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 30, color: "var(--bone)", margin: 0 }}>THE GALACTIC WAR</h1>
        <p style={{ fontSize: 11, color: "var(--bone-dim)", letterSpacing: "0.2em" }}>
          {balance.season ? `WAR OF ${balance.season.label}` : "NO ACTIVE WAR"}
        </p>
      </header>

      {/* warfront balance */}
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: "var(--gold)" }}>{loyal.toLocaleString()} VP LOYALIST</span>
          <span style={{ color: "var(--crimson)" }}>{traitor.toLocaleString()} VP TRAITOR</span>
        </div>
        <div style={{ position: "relative", height: 10, background: "var(--void)", border: "1px solid var(--panel-edge)", borderRadius: 2 }}>
          <div style={{ position: "absolute", left: `calc(${marker}% - 2px)`, top: -3, width: 4, height: 16, background: "var(--bone)" }} />
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "var(--bone-dim)", marginTop: 10 }}>
          {diff === 0 ? "THE WAR HANGS IN BALANCE" : diff > 0 ? "THE WAR FAVORS THE LOYALISTS" : "THE WAR FAVORS THE TRAITORS"}
        </p>
      </section>

      {/* auth or submit */}
      {profile ? (
        <>
          <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--bone-dim)", letterSpacing: "0.2em" }}>SIGNED IN AS</div>
              <Link href={`/profile/${profile.handle}`} style={{ fontSize: 18, fontFamily: "Cinzel, serif" }}>
                {profile.handle}
              </Link>
              <EditHandle current={profile.handle} />
            </div>
            <form action={signOut}>
              <button className="btn-ghost" type="submit">SIGN OUT</button>
            </form>
          </section>
          <SubmitForm />
        </>
      ) : (
        <AuthPanel />
      )}

      {/* dispatches */}
      <section style={{ marginTop: 36 }}>
        <h2 style={{ fontSize: 16 }}>DISPATCHES FROM THE FRONT</h2>
        {recent.length === 0 ? (
          <p style={{ color: "var(--bone-dim)", fontSize: 12 }}>No battles yet. Be the first.</p>
        ) : (
          recent.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--panel-edge)", fontSize: 12 }}>
              <span style={{ width: 8, height: 8, transform: "rotate(45deg)", background: b.side === "loyalist" ? "var(--gold)" : "var(--crimson)" }} />
              <span style={{ flexGrow: 1, color: "var(--bone)" }}>
                {b.faction}{b.event ? <span style={{ color: "var(--bone-dim)" }}> · {b.event}</span> : null}
              </span>
              <span style={{ color: "var(--bone)" }}>+{b.score} VP</span>
              <Link href={`/profile/${b.handle}`} style={{ fontSize: 10, minWidth: 90, textAlign: "right" }}>{b.handle}</Link>
              <span style={{ color: "var(--neutral)", fontSize: 10, minWidth: 70, textAlign: "right" }}>{timeAgo(b.created_at)}</span>
            </div>
          ))
        )}
        <p style={{ marginTop: 16 }}>
          <Link href="/ledger">→ Search the full public ledger</Link>
          {profile?.is_admin && <> · <Link href="/admin">⚙ Admin</Link></>}
        </p>
      </section>
    </main>
  );
}
