"use server";

import { searchLedger } from "@/lib/data";

export async function runSearch(q: string) {
  if (!q || q.trim().length < 1) return [];
  return searchLedger(q.trim());
}
