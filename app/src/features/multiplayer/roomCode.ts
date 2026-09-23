/** Room codes (backend RoomService.CODE_ALPHABET): six characters, no 0/O/1/I/L, so a code never spells a word. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/** Uppercases and drops characters that can never appear in a code; safe to run on every keystroke or paste. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().split("").filter((ch) => CODE_ALPHABET.includes(ch)).join("").slice(0, CODE_LENGTH);
}

export function isCompleteCode(code: string): boolean {
  return code.length === CODE_LENGTH && normalizeCode(code) === code;
}

/** Letters and digits spelled one by one for screen readers ("B K 7 Q 2 M"). */
export function spellCode(code: string): string {
  return code.split("").join(" ");
}
