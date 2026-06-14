"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateHandle } from "@/app/profile/[handle]/handle-action";

export default function EditHandle({ current }: { current: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const res = await updateHandle(value);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEditing(false);
    // navigate to the new profile URL since the handle is the route param
    if (res.handle && res.handle !== current) {
      router.push(`/profile/${res.handle}`);
    } else {
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setValue(current); setError(""); }}
        className="btn-ghost"
        style={{ marginTop: 10, fontSize: 10 }}
      >
        EDIT HANDLE
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <label className="label">New handle</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: "1 1 200px" }}
          value={value}
          maxLength={24}
          onChange={(e) => setValue(e.target.value)}
          placeholder="3–24 chars: a–z 0–9 . _ -"
        />
        <button className="btn" onClick={save} disabled={busy} style={{ flex: "0 0 auto" }}>
          {busy ? "…" : "SAVE"}
        </button>
        <button className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
          CANCEL
        </button>
      </div>
      {error && <p style={{ color: "var(--crimson)", fontSize: 12, marginTop: 8 }}>⚠ {error}</p>}
    </div>
  );
}
