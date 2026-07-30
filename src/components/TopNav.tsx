import Link from "next/link";
import { getCurrentProfile } from "@/lib/data";

// Slim top navigation — the app's main menu, on every page.
export default async function TopNav() {
  const profile = await getCurrentProfile().catch(() => null);

  const links = [
    { href: "/", label: "THE WAR" },
    { href: "/events", label: "EVENTS" },
    { href: "/leaderboard", label: "LEADERBOARD" },
    { href: "/ledger", label: "LEDGER" },
  ];

  return (
    <nav
      className="data"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 22,
        flexWrap: "wrap",
        padding: "13px 22px",
        fontSize: 10,
        letterSpacing: "0.26em",
        background: "rgba(5,5,7,0.88)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid var(--panel-edge-soft)",
      }}
    >
      <Link href="/" style={{ fontFamily: "Cinzel, serif", fontSize: 12, letterSpacing: "0.2em", color: "var(--gold-bright)", marginRight: 6 }}>
        ✦ THE GALACTIC WAR
      </Link>
      {links.map((l) => (
        <Link key={l.href} href={l.href} style={{ color: "var(--bone-dim)" }}>
          {l.label}
        </Link>
      ))}
      {profile?.is_admin && (
        <Link href="/admin" style={{ color: "var(--crimson-bright)" }}>
          ADMIN
        </Link>
      )}
      {profile && (
        <Link href={`/profile/${profile.handle}`} style={{ marginLeft: "auto", color: "var(--gold-bright)" }}>
          {profile.handle.toUpperCase()}
        </Link>
      )}
    </nav>
  );
}
