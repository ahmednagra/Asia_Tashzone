import { compile } from "@tashzone/engine";

export const TUTORIAL_GAME = "callbreak";
export const TUTORIAL_PROFILE = "callbreak.np@1";
export const TUTORIAL_PRESET = "classic";
export const TUTORIAL_SEED = "000000000000000000000000000000000000000000000000000000000000067a";
export const TUTORIAL_BOTS = "easy" as const;

type Rules = Extract<ReturnType<typeof compile>, { ok: true }>["rules"];

export function tutorialRules(): Rules | null {
  const r = compile(TUTORIAL_PROFILE, {}, TUTORIAL_PRESET);
  return r.ok ? { ...r.rules, rounds: 1 } : null;
}
