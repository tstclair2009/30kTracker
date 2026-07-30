import { getWarBalance, getRecentBattles, getCurrentProfile, getPlayerProfile, getActiveWarzone, getWarzoneHistory, getSubmittableEvents, getMyRecentBattles, getMyEventMemberships } from "@/lib/data";
import AuthPanel from "@/components/AuthPanel";
import SubmitForm from "@/components/SubmitForm";
import { signOut } from "@/app/actions";
import EditHandle from "@/components/EditHandle";
import SpaceBattle from "@/components/SpaceBattle";
import MiniProfileCard from "@/components/MiniProfileCard";
import MyRecentReports from "@/components/MyRecentReports";
import Dispatches from "@/components/Dispatches";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [balance, recent, profile, warzone, warzoneHistory] = await Promise.all([
    getWarBalance(),
    getRecentBattles(20),
    getCurrentProfile(),
    getActiveWarzone(),
    getWarzoneHistory(),
  ]);
  const [submittableEvents, myReports, myEvents] = await Promise.all([
    getSubmittableEvents(profile?.id ?? null),
    getMyRecentBattles(profile?.id ?? null),
    getMyEventMemberships(profile?.id ?? null),
  ]);

  // logged-in player's own record for the mini card (null until they've fought)
  const myRecord = profile ? await getPlayerProfile(profile.handle) : null;

  const loyal = Number(balance.loyalist_vp) || 0;
  const traitor = Number(balance.traitor_vp) || 0;
  const diff = loyal - traitor;
  const total = loyal + traitor;
  // Marker = loyalist share of total VP, eased off the extremes so it never
  // fully pins to an edge. Tracks intuitively at any score magnitude.
  // LOYALIST label is on the left, TRAITOR on the right. The marker should move
  // TOWARD the winning side, so a loyalist lead pulls it left. Position by
  // traitor share: high traitor share -> marker right, high loyalist share -> left.
  const traitorShare = total > 0 ? traitor / total : 0.5;
  const marker = total > 0 ? 6 + traitorShare * 88 : 50; // 6%..94%, centered when empty

  return (
    <main className="wrap">
      <SpaceBattle balance={loyal - traitor} />

      {/* ——— title card ——— */}
      <header className="rise" style={{ textAlign: "center", marginBottom: 12, marginTop: 26 }}>
        <div className="eyebrow eyebrow-gold" style={{ marginBottom: 12 }}>
          {balance.season ? `✦ THE WAR OF ${balance.season.label} ✦` : "✦ NO ACTIVE WAR ✦"}
        </div>
        <h1 className="display-xl" style={{ fontSize: "clamp(34px, 7vw, 58px)" }}>
          THE GALACTIC WAR
        </h1>
        <p className="prose" style={{ maxWidth: 460, margin: "10px auto 0", fontStyle: "italic" }}>
          Every battle recorded here tilts the fate of the galaxy.
        </p>
      </header>

      {/* ——— warfront gauge (signature) ——— */}
      <section className="panel rise-2" style={{ marginTop: 28, padding: "32px 30px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 12 }}>
          <div>
            <div className="eyebrow eyebrow-gold">LOYALIST</div>
            <div className="war-num" style={{ color: "var(--gold-bright)" }}>{loyal.toLocaleString()}</div>
          </div>
          <div className="eyebrow" style={{ paddingBottom: 8 }}>VICTORY POINTS</div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow eyebrow-crimson">TRAITOR</div>
            <div className="war-num" style={{ color: "var(--crimson-bright)" }}>{traitor.toLocaleString()}</div>
          </div>
        </div>

        <div className="gauge-shell">
          <div className="gauge-glow-l" style={{ opacity: 0.35 + Math.max(0, 0.5 - traitorShare) * 1.3 }} />
          <div className="gauge-glow-r" style={{ opacity: 0.35 + Math.max(0, traitorShare - 0.5) * 1.3 }} />
          <div className="gauge-ticks" />
          <div className="gauge-center" />
          <div className="gauge-blade" style={{ left: `calc(${marker}% - 1.5px)` }} />
        </div>

        <p className="eyebrow" style={{ textAlign: "center", marginTop: 14, letterSpacing: "0.4em" }}>
          {diff === 0 ? "THE WAR HANGS IN BALANCE" : diff > 0 ? "THE WAR FAVORS THE LOYALISTS" : "THE WAR FAVORS THE TRAITORS"}
        </p>
      </section>

      {/* ——— current warzone: the chapter of the war ——— */}
      {warzone && (
        <section className="panel" style={{ marginTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px" }}>
              <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>
                CHAPTER {warzone.sequence} · ACTIVE WARZONE
              </div>
              <h2 className="display-xl" style={{ fontSize: "clamp(22px, 4vw, 32px)" }}>
                THE BATTLE FOR {warzone.name.toUpperCase()}
              </h2>
              {warzone.narrative && (
                <p className="prose" style={{ fontStyle: "italic", marginTop: 8, marginBottom: 0 }}>
                  {warzone.narrative}
                </p>
              )}
            </div>
            <div className="data" style={{ textAlign: "right", minWidth: 150 }}>
              <div style={{ fontSize: 20, color: "var(--gold-bright)" }}>{warzone.loyalist_vp.toLocaleString()} <span style={{ fontSize: 10, color: "var(--bone-dim)" }}>LOYALIST</span></div>
              <div style={{ fontSize: 20, color: "var(--crimson-bright)" }}>{warzone.traitor_vp.toLocaleString()} <span style={{ fontSize: 10, color: "var(--bone-dim)" }}>TRAITOR</span></div>
              <div style={{ fontSize: 10, color: "var(--neutral)", marginTop: 6, letterSpacing: "0.15em" }}>
                {warzone.battle_count} GAME{warzone.battle_count === 1 ? "" : "S"} REPORTED
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ——— the war so far: concluded chapters ——— */}
      {warzoneHistory.filter((z) => z.status === "concluded").length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>THE WAR SO FAR</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {warzoneHistory.filter((z) => z.status === "concluded").map((z) => {
              const lWin = z.loyalist_vp > z.traitor_vp;
              const even = z.loyalist_vp === z.traitor_vp;
              const c = even ? "var(--bone-dim)" : lWin ? "var(--gold-bright)" : "var(--crimson-bright)";
              return (
                <div key={z.warzone_id} className="data" style={{ border: "1px solid var(--panel-edge-soft)", borderRadius: 2, padding: "10px 14px", fontSize: 11, background: "var(--panel)" }}>
                  <div style={{ color: "var(--bone)", fontFamily: "Cinzel, serif", letterSpacing: "0.08em", fontSize: 12 }}>
                    {z.sequence}. {z.name}
                  </div>
                  <div style={{ color: c, marginTop: 4, fontSize: 10, letterSpacing: "0.14em" }}>
                    {even ? "CONTESTED" : lWin ? "LOYALIST VICTORY" : "TRAITOR VICTORY"}
                    <span style={{ color: "var(--neutral)" }}> · {z.loyalist_vp}–{z.traitor_vp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ——— auth or submit ——— */}
      {profile ? (
        <>
          <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div className="eyebrow">SIGNED IN AS</div>
              <Link href={`/profile/${profile.handle}`} className="display" style={{ fontSize: 20, letterSpacing: "0.06em" }}>
                {profile.handle}
              </Link>
              <div style={{ marginTop: 8 }}>
                <EditHandle current={profile.handle} />
              </div>
            </div>
            <form action={signOut}>
              <button className="btn-ghost" type="submit">SIGN OUT</button>
            </form>
          </section>
          {myRecord && (
            <MiniProfileCard standing={myRecord.standing} factions={myRecord.factions} />
          )}

          {/* the player's event memberships: shows approval status at a glance */}
          {myEvents.length > 0 && (
            <section className="panel">
              <div className="eyebrow eyebrow-gold" style={{ marginBottom: 10 }}>YOUR EVENTS</div>
              <div className="data" style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                {myEvents.map((m) => {
                  const c =
                    m.myStatus === "approved" ? "var(--gold-bright)"
                    : m.myStatus === "requested" ? "var(--bone-dim)"
                    : "var(--crimson-bright)";
                  const tag =
                    m.myStatus === "approved" ? "✓ ON THE ROSTER"
                    : m.myStatus === "requested" ? "⧗ AWAITING APPROVAL"
                    : "NOT ACCEPTED";
                  return (
                    <Link key={m.eventId} href={`/event/${m.eventId}`}
                      style={{ border: "1px solid var(--panel-edge-soft)", borderRadius: 2, padding: "8px 12px", textDecoration: "none" }}>
                      <span style={{ color: "var(--bone)" }}>{m.name}</span>
                      <span style={{ color: c, fontSize: 10, letterSpacing: "0.14em", marginLeft: 10 }}>{tag}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <SubmitForm events={submittableEvents.map((e: any) => ({ id: e.id, name: e.name }))} />
          <MyRecentReports reports={myReports} />
        </>
      ) : (
        <AuthPanel />
      )}

      {/* ——— dispatches ——— */}
      <section style={{ marginTop: 48 }}>
        <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>VOX INTERCEPTS</div>
        <h2 className="section-title">DISPATCHES FROM THE FRONT</h2>
        <div style={{ marginTop: 14 }}>
          <Dispatches initial={recent} />
        </div>
        <hr className="divider" />
        <p className="data" style={{ fontSize: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/ledger">Search the public ledger →</Link>
          <Link href="/leaderboard">Leaderboard →</Link>
          <Link href="/events">Events →</Link>
          {profile?.is_admin && <Link href="/admin">⚙ Admin</Link>}
        </p>
      </section>
    </main>
  );
}
