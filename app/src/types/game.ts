/** Catalogue entry (01_GAME_RULES.md). Only frozen, implemented profiles are playable. */
export interface GameEntry {
  id: string; name: string; alias?: string; region: string; profile?: string; status: "play" | "soon";
  /** catalogue presentation (all optional so older callers keep compiling) */
  suit?: "S" | "H" | "D" | "C";
  /** minimum and maximum players */
  seats?: [number, number];
  /** "Solo" or "Pairs" */
  teams?: string;
  /** one-sentence objective */
  description?: string;
  /** short labelled rule lines for the game page */
  rules?: { label: string; text: string }[];
  /** feature chips on tiles and the game page */
  tags?: string[];
  difficulty?: "Easy" | "Medium" | "Hard";
}

/** Setup choices per profile (TashZone v1): presets shown first-to-last, match lengths, player counts. */
export interface SetupInfo {
  presets: { id: string; label: string; hint: string }[];
  lengthLabel: string;
  lengths: { label: string; settings: Record<string, unknown> }[];
  defaultLength: number;
  players?: number[];
  handicaps?: { value: number; label: string }[];
}
