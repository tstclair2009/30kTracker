import { getCurrentProfile } from "@/lib/data";
import { redirect } from "next/navigation";
import AdminPanels from "@/components/AdminPanels";
import Link from "next/link";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  // server-side gate — non-admins never receive the page
  if (!profile?.is_admin) redirect("/");

  return (
    <main className="wrap">
      <p><Link href="/">← Back to the war</Link></p>
      <div style={{ fontSize: 10, color: "var(--crimson)", letterSpacing: "0.2em" }}>
        ⚙ DEPARTMENTO MUNITORUM · ADMIN
      </div>
      <h1 style={{ fontSize: 22, color: "var(--bone)" }}>WAR ADMINISTRATION</h1>
      <AdminPanels />
    </main>
  );
}
