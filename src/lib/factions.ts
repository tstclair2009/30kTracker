// Single source of truth for factions and their default allegiance.
export type Side = "loyalist" | "traitor";

export const FACTIONS: { name: string; side: Side }[] = [
  { name: "Dark Angels", side: "loyalist" },
  { name: "Emperor's Children", side: "traitor" },
  { name: "Iron Warriors", side: "traitor" },
  { name: "White Scars", side: "loyalist" },
  { name: "Space Wolves", side: "loyalist" },
  { name: "Imperial Fists", side: "loyalist" },
  { name: "Night Lords", side: "traitor" },
  { name: "Blood Angels", side: "loyalist" },
  { name: "Iron Hands", side: "loyalist" },
  { name: "World Eaters", side: "traitor" },
  { name: "Ultramarines", side: "loyalist" },
  { name: "Death Guard", side: "traitor" },
  { name: "Thousand Sons", side: "traitor" },
  { name: "Sons of Horus", side: "traitor" },
  { name: "Word Bearers", side: "traitor" },
  { name: "Salamanders", side: "loyalist" },
  { name: "Raven Guard", side: "loyalist" },
  { name: "Alpha Legion", side: "traitor" },
  { name: "Legio Custodes", side: "loyalist" },
  { name: "Sisters of Silence", side: "loyalist" },
  { name: "Mechanicum", side: "loyalist" },
  { name: "Solar Auxilia", side: "loyalist" },
  { name: "Imperialis Militia", side: "loyalist" },
  { name: "Questoris Knights", side: "loyalist" },
  { name: "Blackshields", side: "traitor" },
  { name: "Daemons of the Ruinstorm", side: "traitor" },
  { name: "Talons of the Emperor", side: "loyalist" },
];

export function sideForFaction(name: string): Side {
  return FACTIONS.find((f) => f.name === name)?.side ?? "loyalist";
}
