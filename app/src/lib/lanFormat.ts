/**
 * Pure helpers for same Wi-Fi play: table names and mDNS TXT records. No native imports, so vitest covers them.
 * The table PIN is never part of any advertised record; players read it from the host's screen.
 */

/** Version tag in the TXT record. A scanner ignores tables that speak another version. */
export const TXT_VERSION = '1';
/** Android NSD limits a service name to 63 bytes of UTF-8. */
export const MAX_SERVICE_NAME_BYTES = 63;
const MAX_NICKNAME_CHARS = 24;
const MAX_GAME_CHARS = 32;
const MAX_OPEN_SEATS = 8;

export interface NearbyTable {
  /** mDNS service name (unique on the network; used as the list key). */
  name: string;
  host: string;
  port: number;
  game: string;
  hostNickname: string;
  /** Free seats at the moment of the last advertisement. */
  open: number;
}

export interface TableInfo {
  game: string;
  hostNickname: string;
  open: number;
}

export interface RawService {
  name: string;
  port: number;
  addresses?: string[];
  txt?: Record<string, unknown>;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const cleanText = (value: string, maxChars: number): string =>
  [...value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim()].slice(0, maxChars).join('');

/** Cuts to a UTF-8 byte budget without splitting a character. */
export function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  let out = '';
  let used = 0;
  for (const ch of value) {
    const size = encoder.encode(ch).length;
    if (used + size > maxBytes) break;
    out += ch;
    used += size;
  }
  return out;
}

const SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * A service name that is readable and unlikely to collide with another table on the same Wi-Fi:
 * "<nickname>'s table-x7k". `random` returns [0,1) and is injectable for tests.
 */
export function generateTableName(nickname: string, random: () => number = Math.random): string {
  const suffix = Array.from({ length: 3 }, () => SUFFIX_ALPHABET[Math.floor(random() * SUFFIX_ALPHABET.length) % SUFFIX_ALPHABET.length]).join('');
  const base = cleanText(nickname, MAX_NICKNAME_CHARS) || 'Table';
  const tail = `-${suffix}`;
  const stem = truncateUtf8(`${base}'s table`, MAX_SERVICE_NAME_BYTES - tail.length);
  return `${stem}${tail}`;
}

/** TXT record to publish. Values are strings, length-capped; the PIN has no field here by design. */
export function buildTxt(info: TableInfo): Record<string, string> {
  return {
    v: TXT_VERSION,
    game: cleanText(info.game, MAX_GAME_CHARS),
    host: cleanText(info.hostNickname, MAX_NICKNAME_CHARS),
    open: String(clampOpen(info.open)),
  };
}

const clampOpen = (value: number): number => (Number.isFinite(value) ? Math.min(MAX_OPEN_SEATS, Math.max(0, Math.trunc(value))) : 0);

export function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** Usable LAN address: IPv4, not unspecified, not loopback, not link-local. */
export function pickIpv4(addresses: readonly string[] | undefined): string | null {
  for (const a of addresses ?? []) {
    if (isIpv4(a) && a !== '0.0.0.0' && !a.startsWith('127.') && !a.startsWith('169.254.')) return a;
  }
  return null;
}

/** Turns a resolved mDNS service into a table, or null when it is not one of ours or is malformed. */
export function parseService(service: RawService): NearbyTable | null {
  const txt = service.txt;
  if (!txt || txt.v !== TXT_VERSION) return null;
  const host = pickIpv4(service.addresses);
  if (!host) return null;
  if (!Number.isInteger(service.port) || service.port < 1 || service.port > 65535) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? cleanText(v, max) : '');
  const open = typeof txt.open === 'string' && /^\d{1,2}$/.test(txt.open) ? clampOpen(Number(txt.open)) : 0;
  return {
    name: service.name,
    host,
    port: service.port,
    game: str(txt.game, MAX_GAME_CHARS),
    hostNickname: str(txt.host, MAX_NICKNAME_CHARS),
    open,
  };
}
