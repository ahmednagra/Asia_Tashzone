import { useEffect, useRef, useState } from "react";
import type { CardId } from "@tashzone/engine";
import { lastTrick } from "./insights";

const TICK_MS = 250;

/**
 * Turn clock: counts `totalMs` down while `active` and not `paused`, restarting whenever `turnKey` changes;
 * calls `onExpire` once per turn when it reaches zero. Returns the time left.
 */
export function useTurnClock(active: boolean, turnKey: string, totalMs: number, paused: boolean, onExpire: () => void): number {
  const [left, setLeft] = useState(totalMs);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  const fired = useRef<string | null>(null);
  useEffect(() => { setLeft(totalMs); fired.current = null; }, [turnKey, totalMs]);
  useEffect(() => {
    if (!active || paused) return;
    const id = setInterval(() => setLeft((l) => Math.max(0, l - TICK_MS)), TICK_MS);
    return () => clearInterval(id);
  }, [active, paused, turnKey]);
  useEffect(() => {
    if (active && left <= 0 && fired.current !== turnKey) { fired.current = turnKey; expire.current(); }
  }, [active, left, turnKey]);
  return left;
}

interface Played { readonly seat: number; readonly card: CardId }

/**
 * The engine clears a trick the moment it is complete; a table needs a beat to show it (§13.5 trick hold).
 * Returns the trick to draw and, while held, who took it. A new lead cancels the hold at once.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useTrickHold(view: any, names: readonly string[], holdMs: number): { trick: readonly Played[]; taken: string | null } {
  const current: readonly Played[] = view.hand?.trick ?? [];
  const last = lastTrick(view, names);
  const key = last ? last.plays.map((p) => `${p.seat}${p.card}`).join(",") : "";
  const seen = useRef(key);
  const [held, setHeld] = useState<{ plays: readonly Played[]; text: string } | null>(null);
  useEffect(() => {
    if (key === seen.current) return;
    seen.current = key;
    if (!last || current.length > 0 || holdMs <= 0) { setHeld(null); return; }
    setHeld({ plays: last.plays, text: last.text });
    const t = setTimeout(() => setHeld(null), holdMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (current.length > 0) return { trick: current, taken: null };
  return held ? { trick: held.plays, taken: held.text } : { trick: [], taken: null };
}

/** Time left until a server deadline (epoch ms), refreshed while `active`; null when there is none. */
export function useDeadlineLeft(deadline: number | null | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !deadline) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [active, deadline]);
  return active && deadline ? Math.max(0, deadline - now) : null;
}
