import { getWarBalance, getRecentBattles, getCurrentProfile, getPlayerProfile, getActiveWarzone, getWarzoneHistory, getSubmittableEvents, getMyRecentBattles, getMyEventMemberships, getMyEventBattles, getSeasonEventsPublic } from "@/lib/data";
import AuthPanel from "@/components/AuthPanel";
import SubmitForm from "@/components/SubmitForm";
import { signOut } from "@/app/actions";
import EditHandle from "@/components/EditHandle";
import LiveWarGauge from "@/components/LiveWarGauge";
import MiniProfileCard from "@/components/MiniProfileCard";
import EventsHub from "@/components/EventsHub";
import { DISCORD_URL } from "@/lib/site";
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
  const [submittableEvents, myReports, myEvents, myEventBattles, seasonEvents] = await Promise.all([
    getSubmittableEvents(profile?.id ?? null),
    getMyRecentBattles(profile?.id ?? null),
    getMyEventMemberships(profile?.id ?? null),
    getMyEventBattles(profile?.id ?? null),
    getSeasonEventsPublic(profile?.id ?? null),
  ]);

  // logged-in player's own record for the mini card (null until they've fought)
  const myRecord = profile ? await getPlayerProfile(profile.handle) : null;

  const loyal = Number(balance.loyalist_vp) || 0;
  const traitor = Number(balance.traitor_vp) || 0;

  // running events the player isn't part of yet — offered for enlistment
  const joinableEvents = (seasonEvents as any[]).filter(
    (e) => ["open", "active"].includes(e.status) && !e.my_status
  );

  const concluded = warzoneHistory.filter((z) => z.status === "concluded");

  // The warzone chapter + history. For signed-in players this sits between the
  // report section and the events section; signed-out visitors see it right
  // under the gauge.
  const warzoneSection = (
    <>
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

      {concluded.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>THE WAR SO FAR</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {concluded.map((z) => {
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
    </>
  );

  return (
    <main className="wrap">
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

      {/* ——— warfront gauge (signature) — live via Supabase Realtime ——— */}
      <LiveWarGauge initialLoyal={loyal} initialTraitor={traitor} />

      {profile ? (
        <>
          {/* account bar */}
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

          {/* 1 — rank */}
          {myRecord && (
            <MiniProfileCard standing={myRecord.standing} factions={myRecord.factions} />
          )}

          {/* 2 — report */}
          <SubmitForm events={submittableEvents.map((e: any) => ({ id: e.id, name: e.name, enrolled: e.enrolled }))} />
          <MyRecentReports reports={myReports} />

          {/* 3 — warzone */}
          {warzoneSection}

          {/* 4 — events */}
          <EventsHub memberships={myEvents} reports={myEventBattles} joinable={joinableEvents} />
        </>
      ) : (
        <>
          {warzoneSection}
          <AuthPanel />
        </>
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
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-bright)" }}>
            Join the Discord ↗
          </a>
          {profile?.is_admin && <Link href="/admin">⚙ Admin</Link>}
        </p>
      </section>
    </main>
  );
}
