import { getCurrentProfile, getActiveWarzones } from "@/lib/data";
import { redirect } from "next/navigation";
import AdminPanels from "@/components/AdminPanels";
import CampaignAdmin from "@/components/CampaignAdmin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [profile, activeWarzones] = await Promise.all([getCurrentProfile(), getActiveWarzones()]);
  // server-side gate — non-admins never receive the page
  if (!profile?.is_admin) redirect("/");

  return (
    <main className="wrap">
      <p><Link href="/">← Back to the war</Link></p>
      <div className="eyebrow eyebrow-crimson">
        ⚙ DEPARTMENTO MUNITORUM · ADMIN
      </div>
      <h1 className="display-xl" style={{ fontSize: "clamp(26px, 5vw, 38px)", marginTop: 4 }}>WAR ADMINISTRATION</h1>
      <CampaignAdmin activeWarzones={activeWarzones.map((w) => ({ id: w.warzone_id, name: w.name, sequence: w.sequence }))} />
      <AdminPanels />
    </main>
  );
}
