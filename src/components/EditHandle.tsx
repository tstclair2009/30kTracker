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
  const [done, setDone] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const res = await updateHandle(value);

    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }

    const newHandle = res.handle ?? current;

    if (newHandle === current) {
      // no actual change
      setBusy(false);
      setEditing(false);
      router.refresh();
      return;
    }

    // The handle changed, so the current /profile/<old> route no longer exists.
    // Refresh server data first (so the new row is visible), then navigate to
    // the new profile URL. Using replace() avoids leaving the dead old URL in
    // history. A brief settle delay prevents racing the DB write/cache.
    setDone(true);
    router.refresh();
    setTimeout(() => {
      router.replace(`/profile/${newHandle}`);
    }, 350);
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setEditing(true); setValue(current); setError(""); }}
        className="btn-ghost"
        style={{ fontSize: 10 }}
      >
        EDIT HANDLE
      </button>
    );
  }

  return (
    <div style={{ marginTop: 4, width: "100%" }}>
      <label className="label">New handle</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: "1 1 200px" }}
          value={value}
          maxLength={24}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          placeholder="3–24 chars: a–z 0–9 . _ -"
        />
        <button className="btn" onClick={save} disabled={busy} style={{ flex: "0 0 auto" }}>
          {busy ? (done ? "SAVED ✓" : "…") : "SAVE"}
        </button>
        <button className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
          CANCEL
        </button>
      </div>
      {error && <p style={{ color: "var(--crimson)", fontSize: 12, marginTop: 8 }}>⚠ {error}</p>}
    </div>
  );
}
