import React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { T } from "./copy";

type Shape = { t: "p"; d: string } | { t: "c"; cx: number; cy: number; r: number } | { t: "e"; cx: number; cy: number; rx: number; ry: number };
const p = (d: string): Shape => ({ t: "p", d });
const c = (cx: number, cy: number, r: number): Shape => ({ t: "c", cx, cy, r });
const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ t: "e", cx, cy, rx, ry });

/** Drawn avatar marks from the mockup (name, stroke, background, shapes on a 32x32 grid). No photographs. */
export const AVATARS: { name: string; stroke: string; bg: string; shapes: Shape[] }[] = [
  { name: "Lantern", stroke: "#f0c674", bg: "#4a2f10", shapes: [p("M12 4h8M16 4v2M9 8h14l-2 12H11z"), p("M16 11v6M13 13h6"), p("M14 24h4")] },
  { name: "Kite", stroke: "#7fd3e0", bg: "#17364a", shapes: [p("M16 4l8 9-8 15-8-15z"), p("M16 4v24M8 13h16"), p("M16 28l4 3-4 1-4-1z")] },
  { name: "Peacock", stroke: "#5fd0a8", bg: "#123f31", shapes: [c(16, 9, 3), p("M16 12v14"), p("M8 26c0-7 4-11 8-11s8 4 8 11"), c(11, 21, 1.6), c(21, 21, 1.6)] },
  { name: "Tabla", stroke: "#e8a25c", bg: "#4a2410", shapes: [e(16, 11, 8, 4), p("M8 11v9c0 3 3.6 5 8 5s8-2 8-5v-9"), p("M11 15v7M21 15v7")] },
  { name: "Moon", stroke: "#d8c6f0", bg: "#241a4a", shapes: [p("M20 5a11 11 0 1 0 6 18A12 12 0 0 1 20 5z"), c(24, 9, 1.4), c(27, 14, 1)] },
  { name: "Parrot", stroke: "#ef8f7a", bg: "#5a1a14", shapes: [p("M19 6a7 7 0 0 1 0 14c-5 0-8 4-8 8"), p("M19 10l5 2-5 2"), c(17, 10, 1.3), p("M11 28h9")] },
  { name: "Truck", stroke: "#f2d06b", bg: "#4a3a10", shapes: [p("M5 20h14V10H5zM19 13h5l3 4v3h-8z"), c(10, 24, 2.4), c(22, 24, 2.4), p("M7 7h10")] },
  { name: "Teapot", stroke: "#8fd0c0", bg: "#12403a", shapes: [p("M7 14h14v5a7 7 0 0 1-14 0z"), p("M21 16h3a3 3 0 0 1 0 6h-1"), p("M4 16l3-1"), p("M14 14v-3M12 11h4")] },
];

export const avatarName = (i: number) => T.avatars[Math.abs(i) % AVATARS.length] ?? AVATARS[Math.abs(i) % AVATARS.length]!.name;
export const avatarBg = (i: number) => AVATARS[Math.abs(i) % AVATARS.length]!.bg;

/** Line-drawn avatar glyph (transparent background; put it on `avatarBg(index)` for the badge look). */
export function AvatarView({ index, size = 26 }: { index: number; size?: number }) {
  const a = AVATARS[Math.abs(index) % AVATARS.length]!;
  const common = { fill: "none", stroke: a.stroke, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {a.shapes.map((s, i) =>
        s.t === "p" ? <Path key={i} d={s.d} {...common} /> : s.t === "c" ? <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} /> : <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />,
      )}
    </Svg>
  );
}
