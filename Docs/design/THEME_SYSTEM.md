# TashZone Theme System

**Status:** proposal, 2026-09-24. Not yet implemented.
**Interactive spec with live contrast checks:** https://claude.ai/artifact/NZh1HDJUUicMF1o2txwRes
**Related:** `UI_AUDIT_2026-09.md` (why the current theme code is broken and what to fix first).

A TashZone theme is a **room to play in**, not a colour list. Switching theme changes the table, the light, the materials, the typography, the motion and the haptics. The cards, layout and rules never move.

---

## 1. Research that shaped the system

| Finding | Consequence |
|---|---|
| Pure white on pure black (21:1) causes halation and fatigue over long sessions. Use tinted grounds and off-white text. | Rule 01: comfort ceiling. No `#000000` ground, no `#FFFFFF` text, body text between 7:1 and 18:1. |
| >80% of Android users run dark mode; card games are played in the evening. | All three themes are dark. Light mode is retired. |
| Green felt has been used since the 1700s because it rests the eye; blue and red felts mark variety and "high-stakes" rooms. | Mehfil keeps green. Darbar uses madder red, Arcade uses deep blue. Felt stays a calm zone in all three. |
| Marvel Snap: cards always win the visual hierarchy; chrome is dark glass that points at the cards. Hearthstone / Slay the Spire / Balatro win on clarity. | Rule 04: card faces are shared and never themed. Only the card back changes. |
| Balatro: colour is the label (blue = chips `#009DFF`, red = mult `#FE5F55`, gold = money). Every pulse shows a number changing. | Rule 05: every theme has `points`, `bid`, `coins` value tokens. Arcade adopts the full Balatro-style feedback. |
| South Asian Teen Patti / Callbreak apps converge on maroon-and-gold luxury and now ship colour themes. Sindhi Ajrak = indigo + madder crimson + white + black. | Darbar uses madder and brass with an Ajrak card back, not generic maroon/gold. |

Sources are listed at the end of the interactive spec.

---

## 2. Ten rules every theme obeys (enforced by tests)

1. **Comfort ceiling.** Body text 7:1–18:1 on its surface. No pure black ground, no pure white text.
2. **Tinted grounds.** Every background carries the theme hue. A neutral grey ground is what made the old "Dark" feel like nothing.
3. **The table is a calm zone.** Felt chosen for rest. All `onTable` text ≥ 4.5:1 on every felt. Ornament never crosses the play area.
4. **Cards never change.** Faces `#FBF8F1`, suit colours, four-colour deck and legal-move halo are identical in all themes. Only the card back is themed.
5. **Colour is a label.** `points`, `bid`, `coins` exist in every theme; hue may change, meaning may not.
6. **One accent, one job.** Accent marks "current / selected" only. Never body text.
7. **Type is part of the theme.** Display face, casing and numerals per theme. Body stays Jost; Urdu stays Noto Nastaliq.
8. **Shape and material are part of the theme.** Radius, surface treatment and button construction change per theme.
9. **Motion has a budget.** Each theme declares a profile; `reducedMotion` collapses all to 120 ms fades. Nothing loops forever on the table.
10. **Touch and text floors.** 44 dp targets, 13 pt minimum text, 4.5:1 text / 3:1 borders in every theme.

---

## 3. The three themes

### Mehfil (`emerald`) — the brand room
Lamp-lit courtyard gathering. Green baize, gold leaf, frosted glass over a felt glow. Default.

| Field | Value |
|---|---|
| Ground / surface / raised | `#070F0D` / `#0D1915` / `#12231D` |
| Text / secondary / muted | `#F4ECD8` / `#A0BDB1` / `#8AA69B` |
| Accent / on-accent | `#E3BD6E` / `#16181D` |
| Value: points / bid / coins | `#8CC8F2` / `#FFA886` / `#E8C36A` |
| Felt base / lit / deep | `#0F4A3C` / `#1A7458` / `#062019` |
| Rim | 4 px walnut `#2E1C11` |
| Card back | Green diagonal weave |
| Display type | Cormorant Garamond 600, sentence case |
| Radius control / chip / felt / button | 14 / 999 / 18 / 999 |
| Surface | Frosted glass `rgba(255,255,255,.055)`, 1 px gold hairline |
| Button | Gold gradient pill (`#F4D9A4 → #C79F56`), ink text |
| Ornament | Felt vignette at top of screens |
| Motion / haptic | Lush / gentle play, crisp win |
| Sound world | Tabla tap, wooden card slide |

### Darbar (`gold`) — the festival room
Royal court on a wedding night. Madder crimson from Ajrak, brass, indigo as second colour. Framed panels, serif capitals, double brass rim on velvet.

| Field | Value |
|---|---|
| Ground / surface / raised | `#140806` / `#1F0F0B` / `#2B1510` |
| Text / secondary / muted | `#F7EBD3` / `#D9BFA0` / `#B0957A` |
| Accent / on-accent | `#F0C45A` / `#1A0E04` |
| Value: points / bid / coins | `#8CC8F2` / `#FFA886` / `#F0C45A` |
| Felt base / lit / deep | `#4A1712` / `#7A2A20` / `#240A07` |
| Rim | 5 px double brass `#B8923E` |
| Card back | True Ajrak: indigo `#1B2A55` field, madder `#7A2A20` medallions, white resist lines, brass border. Symmetric (card backs must not reveal orientation). |
| Display type | Bodoni Moda 700, CAPITALS, +0.16 em tracking |
| Radius | 4 / 3 / 6 / 4 |
| Surface | Framed panel gradient, 1 px `#8A6A4E` border, inset brass rule |
| Button | Embossed brass bar (`#F7D98A → #B8842A`), capitals, 2 px press shadow |
| Ornament | Brass rule + medallion under titles |
| Motion / haptic | Standard / crisp play, firm win |
| Sound world | Brass chime, silk slide |

### Arcade (`arcade`) — the trending room
Modern deck-builder look. Ink-navy ground, deep blue felt with drifting colour bands, chunky outlined slabs, strict colour code.

| Field | Value |
|---|---|
| Ground / surface / raised | `#0B1220` / `#131C2E` / `#1B2640` |
| Text / secondary / muted | `#F5F1E8` / `#B8C2D6` / `#8D98AE` |
| Accent / on-accent | `#FFC940` / `#120A06` |
| Value: points / bid / coins | `#35A7FF` / `#FF5E4D` / `#FFC940` |
| Felt base / lit / deep | `#10233F` / `#1A3D6B` / `#08142A`, plus two drifting bands (blue 16%, red 14%) |
| Rim | 3 px ink outline `#05080F` |
| Card back | Red candy stripe |
| Display type | Jost 700, CAPITALS, +0.02 em; tabular numerals |
| Radius | 10 / 8 / 14 / 10 |
| Surface | Solid slab, 2 px ink outline, 4 px hard drop shadow |
| Button | Deep-red slab `#C8372A`, **white capitals** (WCAG 5.2:1, APCA Lc 80), coral `#FF5E4D` top edge, 4 px press shadow. Bright coral stays the `bid` colour; it is never a text background. |
| Ornament | Subtle blue glow at top |
| Motion / haptic | Juicy / crisp play, firm win |
| Sound world | Arcade blip, digital riffle |

All three pass: text on ground 16.5–16.7:1 (inside the comfort ceiling), muted on raised ≥ 5.2:1, accent ≥ 9:1, value colours ≥ 6.2:1, borders ≥ 3.5:1, weakest `onTable` colour on felt ≥ 5.4:1.

---

## 4. Motion, haptics and sound profiles

| Event | Lush (Mehfil) | Standard (Darbar) | Juicy (Arcade) | Reduced motion |
|---|---|---|---|---|
| Deal | 90 ms/card, 40 ms stagger, slight arc | 90 ms/card, straight | 70 ms/card, overshoot + settle | 120 ms fade |
| Play a card | 220 ms ease-out, glow on landing | 220 ms ease-out | 180 ms, 1.04× pop on landing | 120 ms fade |
| Trick won | Slide to winner 350 ms | Slide 350 ms, brass glint | Snap 250 ms, score pops | Instant |
| Score change | Fade | Fade | Count-up 400 ms in value colour | Instant |
| Your turn | Ring pulses twice, stops | Ring glints once | Ring pops + HUD flash once | Static ring |
| Felt idle | Glow breathes 6 s, stops after 3 cycles | Still | Bands drift 12 s, stop after 2 cycles | Still |
| Game won | Podium rise, gold confetti | Podium rise, brass shimmer | Podium bounce, 2-frame shake, tri-colour confetti | Podium fade |
| Theme switch | Re-dye sweep 480 ms | same | same | 120 ms cross-fade |

`reducedMotion` (user setting **or** OS `AccessibilityInfo`) forces every profile to the last column. Haptics and sound remain.

---

## 5. The switch moment

1. **Live preview with real components.** The picker renders a miniature of the actual `Felt` (felt, rim, card back, HUD) and the actual primary button. No hand-painted preview.
2. **Re-dye transition (~480 ms).** New felt colour sweeps from the tapped option across the screen, then surfaces snap to the new material. One haptic tick at the end.
3. **Signature sound** per theme, reused as that theme's turn-start cue.
4. **Persisted per device** (`tashzone.theme.v1`), plus a "Try another room" shortcut in the table menu.

---

## 6. Implementation plan

```ts
// theme/tokens.ts
export type ThemeId = "emerald" | "gold" | "arcade";

export interface ThemeSpec {
  id: ThemeId;
  name: { en: string; ur: string };
  c: SemanticColors;                                      // bg, surface, surfaceRaised, text…, borders
  accent: { color: string; on: string };
  value: { points: string; bid: string; coins: string };
  felt: { base: string; lit: string; deep: string; rim: RimStyle; bands?: string[] };
  cardBack: "weave" | "ajrak" | "stripe";
  type: { display: string; titleCase: "none" | "uppercase"; tracking: number; numerals: string };
  shape: { radius: number; chip: number; felt: number; button: number };
  surface: "glass" | "framed" | "slab";
  button: "gradient" | "embossed" | "slab";
  ornament: "vignette" | "rule" | "bands";
  motion: "lush" | "standard" | "juicy";
  haptic: { play: HapticStrength; win: HapticStrength };
  sound: { switch: string; turn: string; win: string };
}
```

Steps:
1. Replace `colors: Record<ThemeName, SemanticColors>` with `themes: Record<ThemeId, ThemeSpec>`. `useTheme()` returns the spec; keep `c` for compatibility.
2. Migrate saved prefs: `dark` / `light` → `emerald`. Delete the System/Light/Dark picker in `OptionScreens.tsx`; keep one picker.
3. Remove all 13 `name === "dark"` branches; read `spec.surface` / `spec.button` / `spec.ornament`. StatusBar always `light`.
4. Six components carry ~90% of the change: `Screen`, `GlassCard`, `GoldButton`, `TabBar`, `Felt`, `Header`. Screens should need no edits.
5. Register Jost 700 and Bodoni Moda 700 as their own font families; stop faking weights.
6. Extend `contrast.test.ts` to loop all three specs, add the 18:1 ceiling, and test `points/bid/coins` on bg, surface and felt.
7. Wire `reducedMotion`, `hapticStrength`, `sfxVolume` to the profiles (they currently have no consumers).
8. Splash background → Mehfil ground; Stack/Tabs `contentStyle` from `spec.c.bg`; gate first render on theme + profile + fonts.

### Two decided details (research, 2026-09-24)

**Darbar card back: true Ajrak, not all-red.**
- Authentic Ajrak is a four-colour system: indigo, madder red, black and white resist. Indigo is the dominant field; madder is the motif. Using both is the accurate reading, not a liberty.
- Card backs must be symmetric so they never reveal orientation; the Ajrak grid-and-medallion repeat is symmetric by construction.
- Against the madder felt, both an indigo back (1.06:1) and a madder back (1.53:1) rely on the white card edge (13.9:1) for visibility, so the choice is purely aesthetic. Indigo gives Darbar its second colour and repeating madder in the medallions ties the back to the felt.

**Arcade button: darken the fill, keep white text.**

| Text on fill | WCAG 2.x | APCA Lc | Verdict |
|---|---|---|---|
| White on coral `#FF5E4D` | 3.02 ✗ | 61 ✓ (bold ≥14 px) | Fails WCAG |
| Ink `#120A06` on coral `#FF5E4D` | 6.49 ✓ | 48 ✗ (weak) | Passes WCAG, reads thin |
| White on deep red `#C8372A` | 5.20 ✓ | 80 ✓ | **Passes both** |

Balatro itself runs white text on its red. Store reviewers and automated audits still test WCAG 2.x, so the fill is darkened to `#C8372A` and the coral is kept as the top-edge highlight and as the `bid` value colour.

**Legal note:** Balatro, Marvel Snap and the Teen Patti apps are style references only. Do not use their names, fonts or artwork.
