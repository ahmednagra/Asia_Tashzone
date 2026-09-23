/**
 * Design tokens (06_PRODUCT_UX_BLUEPRINT.md §13). Platform-neutral data consumed by shared/ui (React Native).
 * Authority: semantic colours = blueprint §13.1 (WCAG-measured, re-verified in test/contrast.test.ts).
 * Fonts = the mehfil mockup's choices (resolves PD-03). Material tokens (felt light, walnut rim, gold leaf)
 * come from the mockup and are decorative only — never used for text or state.
 */

export type ThemeName = "dark" | "light";

export interface SemanticColors {
  bg: string; surface: string; surfaceRaised: string;
  text: string; textSecondary: string; textMuted: string;
  primary: string; onPrimary: string;
  success: string; warning: string; error: string; info: string;
  borderControl: string; borderSubtle: string;
  tableFelt: string;
}

export const colors: Record<ThemeName, SemanticColors> = {
  dark: {
    bg: "#0E0F12", surface: "#171A1F", surfaceRaised: "#20242B",
    text: "#F2EEE4", textSecondary: "#B9B3A6", textMuted: "#8F897D",
    primary: "#D4A646", onPrimary: "#1B1D21",
    success: "#3FB67A", warning: "#F08A3C", error: "#F06A6A", info: "#5AA9E6",
    borderControl: "#666E7C", borderSubtle: "#2C313A",
    tableFelt: "#0F3B2E",
  },
  light: {
    bg: "#F6F3EC", surface: "#FFFFFF", surfaceRaised: "#FFFFFF",
    text: "#1B1D21", textSecondary: "#4A4F57", textMuted: "#676C74",
    primary: "#8A6512", onPrimary: "#FFFFFF",
    success: "#1F7A4D", warning: "#A8520F", error: "#B3261E", info: "#1B5FA8",
    borderControl: "#8C8577", borderSubtle: "#D9D3C7",
    tableFelt: "#154A37",
  },
};

/** Anything drawn on the felt; ≥ 4.5:1 on both felts. */
export const onTable = {
  text: "#F7F4EC", secondary: "#D5E3DA", muted: "#B3C7BB", gold: "#E8C36A",
  success: "#6BD49C", warning: "#FFB072", error: "#FFA59E", info: "#8CC8F2",
  teamA: "#8CC8F2", teamB: "#FFA886",
  /** legal-card emphasis is drawn on the felt around the card, never as a tint on the face */
  legalHalo: "#E8C36A",
} as const;

export const cards = {
  face: "#FBF8F1",
  red: "#C62828",
  black: "#1A1A1A",
  /** four-colour deck (accessibility option): ♦ blue, ♣ green */
  fourColor: { S: "#1A1A1A", H: "#C62828", D: "#1565C0", C: "#2E7D32" },
  twoColor: { S: "#1A1A1A", H: "#C62828", D: "#C62828", C: "#1A1A1A" },
} as const;

/** Decorative material from the mehfil mockup (gradients, rims, leaf). Not for text or state. */
export const material = {
  feltLit: "#1a7458", felt: "#0f4a3c", feltDeep: "#062019", feltRim: "#03110d",
  walnut: "#2e1c11", walnutLit: "#6a4626",
  goldLeaf: "#e3bd6e", goldLeafHot: "#f6e0b0", goldLeafDim: "#9d7a32",
  paper1: "#fffdf6", paper2: "#eee6d5",
} as const;

export const fonts = {
  ui: { family: "Jost", fallback: ["system-ui", "sans-serif"], weights: [400, 500, 600, 700] },
  display: { family: "Cormorant Garamond", fallback: ["Georgia", "serif"], weights: [500, 600, 700] },
  cardIndex: { family: "Bodoni Moda", fallback: ["Didot", "Georgia", "serif"], weights: [600, 700] },
  nastaliq: { family: "Noto Nastaliq Urdu", fallback: ["serif"], weights: [400, 700] },
} as const;

/** Type scale in pt (§13.2); Nastaliq +2 pt and line height 1.8. */
export const typeScale = { display: 32, h1: 24, h2: 20, body: 17, secondary: 15, caption: 13 } as const;
export function scaleFor(role: keyof typeof typeScale, script: "latin" | "devanagari" | "nastaliq") {
  const size = typeScale[role] + (script === "nastaliq" ? 2 : 0);
  return { fontSize: size, lineHeight: Math.round(size * (script === "nastaliq" ? 1.8 : 1.35)) };
}

export const space = [4, 8, 12, 16, 24, 32, 48] as const;
export const radius = { control: 12, sheet: 20, chip: 999, card: 8 } as const;
export const minTouchTarget = 44;

/** 2.5D elevation (§13.3): each level adds shadow depth and slight scale. */
export const elevation = [
  { level: 0, name: "felt", shadowRadius: 0, shadowOpacity: 0, offsetY: 0, scale: 1 },
  { level: 1, name: "table-card", shadowRadius: 2, shadowOpacity: 0.25, offsetY: 1, scale: 1 },
  { level: 2, name: "own-hand", shadowRadius: 6, shadowOpacity: 0.3, offsetY: 3, scale: 1.02 },
  { level: 3, name: "lifted", shadowRadius: 12, shadowOpacity: 0.35, offsetY: 8, scale: 1.06 },
  { level: 4, name: "hud-sheet", shadowRadius: 18, shadowOpacity: 0.35, offsetY: 10, scale: 1 },
  { level: 5, name: "modal", shadowRadius: 28, shadowOpacity: 0.45, offsetY: 16, scale: 1 },
] as const;

/** Motion (§13.5), ms. Reduced motion: deals/plays 120 ms fades, no shakes, flips cross-fade. */
export const motion = {
  dealPerCard: 90, dealStagger: 40, play: 220, trickHold: 600, trickSlide: 350, interrupt: 450,
  capture: 300, reveal: 300, score: 400, turn: 200, toast: 180, sheet: 240, reducedFade: 120,
  /** if more than this many batches are queued, animations jump to their end state */
  compressAfterBatches: 2,
} as const;

/** Responsive breakpoints (§15), dp of the shorter side unless noted. */
export const breakpoints = { compactPhone: 360, phone: 400, largePhone: 480, tablet: 600, largeTablet: 840 } as const;

/* ── WCAG 2.1 contrast ── */
function channel(c: number): number { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
