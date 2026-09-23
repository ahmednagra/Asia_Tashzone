/**
 * L-14 runtime projection guard: every outgoing payload is checked against visible_card_ids(state, viewer).
 * Any card identity outside the set blocks the message.
 */
const CARD = /"([2-9TJQKA][CDHS])"/g;

export function guardPayload(json: string, visible: ReadonlySet<string>): boolean {
  for (const m of json.matchAll(CARD)) if (!visible.has(m[1]!)) return false;
  return true;
}
