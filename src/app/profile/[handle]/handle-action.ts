"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// Update the signed-in user's handle. RLS (profiles_self_update) guarantees a
// user can only change their own row. The DB enforces the format constraint and
// uniqueness; we surface those errors in a friendly way.
export async function updateHandle(newHandle: string): Promise<{ ok?: boolean; handle?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const handle = newHandle.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,24}$/.test(handle)) {
    return { error: "Handle must be 3–24 characters: lowercase letters, numbers, and . _ - only." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ handle })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation
    if ((error as any).code === "23505") {
      return { error: "That handle is already taken. Choose another." };
    }
    return { error: "Could not update handle. Try again." };
  }

  revalidatePath("/");
  revalidatePath(`/profile/${handle}`);
  return { ok: true, handle };
}
