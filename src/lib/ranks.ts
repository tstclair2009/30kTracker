// The service-record ladder. Mirrors public.rank_title() in SQL.
// Keep the two in sync if you retune thresholds.
export type Rank = { min: number; title: string; grade: string };

export const RANKS: Rank[] = [
  { min: 0,     title: "Aspirant",             grade: "UNRANKED" },
  { min: 170,   title: "Neophyte",             grade: "INITIATE" },
  { min: 410,   title: "Legionary",            grade: "LINE" },
  { min: 750,   title: "Veteran",              grade: "LINE" },
  { min: 1200,  title: "Sergeant",             grade: "COMMAND" },
  { min: 1900,  title: "Centurion",            grade: "COMMAND" },
  { min: 2900,  title: "Captain",              grade: "COMMAND" },
  { min: 4300,  title: "Lord Commander",       grade: "WARLORD" },
  { min: 6200,  title: "Praetor",              grade: "WARLORD" },
  { min: 9000,  title: "Master of the Legion", grade: "WARLORD" },
  { min: 13000, title: "Primarch",             grade: "APOTHEOSIS" },
];

export function rankFor(vp: number) {
  let cur: Rank = RANKS[0];
  let next: Rank | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (vp >= RANKS[i].min) {
      cur = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  const span = next ? next.min - cur.min : 1;
  const pct = next ? Math.min(1, (vp - cur.min) / span) : 1;
  return { ...cur, next, pct, toNext: next ? next.min - vp : 0 };
}
