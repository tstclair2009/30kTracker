import { getEventDetail, getCurrentProfile, getMyRecentBattles } from "@/lib/data";
import EventActions from "@/components/EventActions";
import SubmitForm from "@/components/SubmitForm";
import MyRecentReports from "@/components/MyRecentReports";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const profile = await getCurrentProfile();
  const data = await getEventDetail(id, profile?.id ?? null);
  if (!data) notFound();

  const { event, organizerHandle, isOrganizer, standings, roster, myStatus } = data;
  const canManage = isOrganizer || Boolean(profile?.is_admin);
  const approved = roster.filter((r) => r.status === "approved");

  // mirrors the may_submit_to_event RLS rule: the event must be running and the
  // viewer either joins freely or sits on the approved roster
  const canSubmit =
    Boolean(profile) &&
    ["open", "active"].includes(event.status) &&
    (event.open_participation || myStatus === "approved");

  return (
    <main className="wrap">
      <p className="data" style={{ fontSize: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Link href="/">← Back to the war</Link>
        <Link href="/events">All events</Link>
      </p>

      <div className="eyebrow eyebrow-gold" style={{ marginBottom: 6 }}>
        {event.is_special ? "SPECIAL EVENT" : "SANCTIONED EVENT"} · {String(event.status).toUpperCase()}
      </div>
      <h1 className="display-xl" style={{ fontSize: "clamp(26px, 5vw, 40px)" }}>{event.name}</h1>
      {event.description && (
        <p className="prose" style={{ fontStyle: "italic", maxWidth: 620 }}>{event.description}</p>
      )}
      <p className="data" style={{ fontSize: 11, color: "var(--bone-dim)", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>ORGANIZER: <Link href={`/profile/${organizerHandle}`}>{organizerHandle}</Link></span>
        <span>{event.rolls_up ? "COUNTS TOWARD THE GLOBAL WAR" : "SELF-CONTAINED (NO ROLL-UP)"}</span>
        <span>{event.open_participation ? "OPEN PARTICIPATION" : "ROSTER BY APPROVAL"}</span>
      </p>

      {/* join / manage */}
      <section className="panel">
        <h2 className="section-title">PARTICIPATION</h2>
        <EventActions
          eventId={event.id}
          signedIn={Boolean(profile)}
          myStatus={myStatus}
          canManage={canManage}
          openParticipation={event.open_participation}
          roster={roster}
        />
      </section>

      {/* report a battle straight into this event */}
      {canSubmit && <SubmitForm fixedEvent={{ id: event.id, name: event.name }} />}
      {canSubmit && (
        <MyRecentReports
          reports={(await getMyRecentBattles(profile!.id)).filter((r) => r.event_id === event.id)}
        />
      )}

      {/* standings */}
      <section className="panel">
        <h2 className="section-title">EVENT STANDINGS</h2>
        {standings.length === 0 ? (
          <p className="prose" style={{ marginTop: 10, marginBottom: 0 }}>
            No games reported into this event yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Soldier</th>
                  <th style={{ textAlign: "right" }}>Battles</th>
                  <th style={{ textAlign: "right" }}>VP</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.handle}>
                    <td style={{ color: "var(--bone-dim)" }}>{i + 1}</td>
                    <td><Link href={`/profile/${s.handle}`} style={{ color: "var(--bone)" }}>{s.handle}</Link></td>
                    <td style={{ textAlign: "right", color: "var(--bone-dim)" }}>{s.battles}</td>
                    <td style={{ textAlign: "right" }}>{s.vp.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* roster */}
      {!event.open_participation && (
        <section className="panel">
          <h2 className="section-title">ROSTER</h2>
          {approved.length === 0 ? (
            <p className="prose" style={{ marginTop: 10, marginBottom: 0 }}>No approved participants yet.</p>
          ) : (
            <div className="data" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, fontSize: 12 }}>
              {approved.map((r) => (
                <Link key={r.id} href={`/profile/${r.handle}`}
                  style={{ border: "1px solid var(--panel-edge-soft)", borderRadius: 2, padding: "7px 12px", color: "var(--bone)" }}>
                  {r.handle}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
