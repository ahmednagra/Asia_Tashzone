/**
 * Design tokens (06_PRODUCT_UX_BLUEPRINT.md §13). Platform-neutral data consumed by shared/ui (React Native).
 * Authority: semantic colours = blueprint §13.1 (WCAG-measured, re-verified in test/contrast.test.ts).
 * Fonts = the mehfil mockup's choices (resolves PD-03). Material tokens (felt light, walnut rim, gold leaf)
 * come from the mockup and are decorative only — never used for text or state.
 */

export type ThemeId = "emerald" | "gold" | "arcade";
export type ThemeName = ThemeId;
export const THEME_IDS: readonly ThemeId[] = ["emerald", "gold", "arcade"];

export interface SemanticColors {
  bg: string; surface: string; surfaceRaised: string;
  text: string; textSecondary: string; textMuted: string;
  primary: string; onPrimary: string;
  success: string; warning: string; error: string; info: string;
  borderControl: string; borderSubtle: string;
  tableFelt: string;
}

export type HapticLevel = "off" | "gentle" | "crisp" | "firm";

export interface ThemeSpec {
  id: ThemeId;
  label: { en: string; ur: string };
  story: string;
  c: SemanticColors;
  accent: { color: string; on: string; dim: string; line: string; lineHard: string };
  value: { points: string; bid: string; coins: string };
  felt: { base: string; lit: string; deep: string; rim: string; rimWidth: number; rimStyle: "solid" | "double"; bands: readonly string[] };
  cardBack: { kind: "weave" | "ajrak" | "stripe"; base: string; motif: string; line: string };
  type: { display: string; titleCase: "none" | "uppercase"; tracking: number; numerals: string };
  shape: { radius: number; chip: number; felt: number; button: number; sheet: number };
  surface: { kind: "glass" | "framed" | "slab"; bg: string; border: string; borderWidth: number; shadow?: string };
  button: { kind: "gradient" | "embossed" | "slab"; fill: readonly [string, string]; ink: string; edge?: string; press?: string; caps: boolean };
  vignette: readonly [string, string];
  ornament: "vignette" | "rule" | "bands";
  tab: { bg: string; border: string; borderWidth: number; pill?: string };
  sheet: { bg: string; border: string };
  motion: "lush" | "standard" | "juicy";
  haptic: { play: HapticLevel; win: HapticLevel };
}

const mehfil: ThemeSpec = {
  id: "emerald", label: { en: "Mehfil", ur: "محفل" }, story: "A lamp-lit courtyard gathering on green baize.",
  c: {
    bg: "#070F0D", surface: "#0D1915", surfaceRaised: "#12231D",
    text: "#F4ECD8", textSecondary: "#A0BDB1", textMuted: "#8AA69B",
    primary: "#E3BD6E", onPrimary: "#16181D",
    success: "#7FE0B0", warning: "#F0B45A", error: "#F58A80", info: "#8CC8F2",
    borderControl: "#666E7C", borderSubtle: "#2C313A",
    tableFelt: "#0F4A3C",
  },
  accent: { color: "#E3BD6E", on: "#16181D", dim: "#9D7A32", line: "rgba(227,189,110,0.22)", lineHard: "rgba(227,189,110,0.4)" },
  value: { points: "#8CC8F2", bid: "#FFA886", coins: "#E8C36A" },
  felt: { base: "#0F4A3C", lit: "#1A7458", deep: "#062019", rim: "#2E1C11", rimWidth: 4, rimStyle: "solid", bands: [] },
  cardBack: { kind: "weave", base: "#0F4A3C", motif: "#1A7458", line: "#E3BD6E" },
  type: { display: "Cormorant Garamond", titleCase: "none", tracking: 0, numerals: "Cormorant Garamond" },
  shape: { radius: 14, chip: 999, felt: 18, button: 999, sheet: 20 },
  surface: { kind: "glass", bg: "rgba(255,255,255,0.055)", border: "rgba(227,189,110,0.22)", borderWidth: 1 },
  button: { kind: "gradient", fill: ["#F4D9A4", "#C79F56"], ink: "#16181D", caps: false },
  vignette: ["#0F3A2E", "#070F0D"],
  ornament: "vignette",
  tab: { bg: "rgba(7,15,13,0.96)", border: "rgba(227,189,110,0.22)", borderWidth: 1 },
  sheet: { bg: "#0F1C18", border: "rgba(227,189,110,0.4)" },
  motion: "lush",
  haptic: { play: "gentle", win: "crisp" },
};

const darbar: ThemeSpec = {
  id: "gold", label: { en: "Darbar", ur: "دربار" }, story: "A royal court on a wedding night: madder velvet and brass.",
  c: {
    bg: "#140806", surface: "#1F0F0B", surfaceRaised: "#2B1510",
    text: "#F7EBD3", textSecondary: "#D9BFA0", textMuted: "#B0957A",
    primary: "#F0C45A", onPrimary: "#1A0E04",
    success: "#7FD6A2", warning: "#F5B35C", error: "#FF9A8C", info: "#8CC8F2",
    borderControl: "#8A6A4E", borderSubtle: "#3A2118",
    tableFelt: "#4A1712",
  },
  accent: { color: "#F0C45A", on: "#1A0E04", dim: "#B8923E", line: "rgba(240,196,90,0.28)", lineHard: "rgba(240,196,90,0.5)" },
  value: { points: "#8CC8F2", bid: "#FFA886", coins: "#F0C45A" },
  felt: { base: "#4A1712", lit: "#7A2A20", deep: "#240A07", rim: "#B8923E", rimWidth: 5, rimStyle: "double", bands: [] },
  cardBack: { kind: "ajrak", base: "#1B2A55", motif: "#7A2A20", line: "#FBF8F1" },
  type: { display: "Bodoni Moda", titleCase: "uppercase", tracking: 2.4, numerals: "Bodoni Moda" },
  shape: { radius: 4, chip: 3, felt: 6, button: 4, sheet: 6 },
  surface: { kind: "framed", bg: "#231209", border: "#8A6A4E", borderWidth: 1, shadow: "rgba(240,196,90,0.18)" },
  button: { kind: "embossed", fill: ["#F7D98A", "#B8842A"], ink: "#1A0E04", press: "#6E4A14", caps: true },
  vignette: ["#3A140E", "#140806"],
  ornament: "rule",
  tab: { bg: "#1F0F0B", border: "#8A6A4E", borderWidth: 2 },
  sheet: { bg: "#1F0F0B", border: "#8A6A4E" },
  motion: "standard",
  haptic: { play: "crisp", win: "firm" },
};

const arcade: ThemeSpec = {
  id: "arcade", label: { en: "Arcade", ur: "آرکیڈ" }, story: "A modern deck-builder: ink navy, deep blue felt, chunky slabs.",
  c: {
    bg: "#0B1220", surface: "#131C2E", surfaceRaised: "#1B2640",
    text: "#F5F1E8", textSecondary: "#B8C2D6", textMuted: "#8D98AE",
    primary: "#FFC940", onPrimary: "#120A06",
    success: "#3DDC84", warning: "#FFB072", error: "#FF8A7E", info: "#35A7FF",
    borderControl: "#5E6B85", borderSubtle: "#26314A",
    tableFelt: "#10233F",
  },
  accent: { color: "#FFC940", on: "#120A06", dim: "#B58A1E", line: "#05080F", lineHard: "#05080F" },
  value: { points: "#35A7FF", bid: "#FF5E4D", coins: "#FFC940" },
  felt: { base: "#10233F", lit: "#1A3D6B", deep: "#08142A", rim: "#05080F", rimWidth: 3, rimStyle: "solid", bands: ["rgba(53,167,255,0.16)", "rgba(255,94,77,0.14)"] },
  cardBack: { kind: "stripe", base: "#C8372A", motif: "#FF5E4D", line: "#FBF8F1" },
  type: { display: "Jost-Bold", titleCase: "uppercase", tracking: 0.5, numerals: "Jost-Bold" },
  shape: { radius: 10, chip: 8, felt: 14, button: 10, sheet: 14 },
  surface: { kind: "slab", bg: "#1B2640", border: "#05080F", borderWidth: 2, shadow: "#05080F" },
  button: { kind: "slab", fill: ["#C8372A", "#C8372A"], ink: "#FFFFFF", edge: "#FF5E4D", press: "#7A1E14", caps: true },
  vignette: ["#12284A", "#0B1220"],
  ornament: "bands",
  tab: { bg: "#131C2E", border: "#05080F", borderWidth: 2, pill: "rgba(255,201,64,0.16)" },
  sheet: { bg: "#131C2E", border: "#05080F" },
  motion: "juicy",
  haptic: { play: "crisp", win: "firm" },
};

export const themes: Record<ThemeId, ThemeSpec> = { emerald: mehfil, gold: darbar, arcade };

export const colors: Record<ThemeId, SemanticColors> = { emerald: mehfil.c, gold: darbar.c, arcade: arcade.c };

export function toThemeId(v: unknown): ThemeId {
  return v === "gold" || v === "arcade" || v === "emerald" ? v : "emerald";
}

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
  obsidian: "#070f0d",
  /** red suit on dark surfaces (mockup --rouge-lit) */
  rougeLit: "#ff6b5b",
  /** hairlines and glass panels drawn over dark surfaces (mockup --line, --line-hard, --glass) */
  line: "rgba(227,189,110,0.22)", lineHard: "rgba(227,189,110,0.4)", glass: "rgba(255,255,255,0.055)",
  /** gold button gradient (mockup --btn-1, --btn-2, --btn-ink) */
  btn1: "#f4d9a4", btn2: "#c79f56", btnInk: "#16181d",
} as const;

export const fonts = {
  ui: { family: "Jost", medium: "Jost-Medium", semibold: "Jost-SemiBold", bold: "Jost-Bold", fallback: ["system-ui", "sans-serif"], weights: [400, 500, 600, 700] },
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
