/**
 * Same-Wi-Fi tables on top of the app's single session store (session.ts): the same wait, table and summary screens
 * read the same `SessionState`, only the transport differs. Host: a `HostTable` (an authoritative Room) served over TCP
 * and advertised over mDNS, played by this phone through `hostSeat`. Guest: `lanGuest` over a TCP link.
 * Everything opened here is closed by the run's teardown (leave, replace, failure): server, advertising, sockets, timers.
 * Not verified on hardware; see README.
 */
import { HostTable, MAX_WRONG_PINS, hostSeat, isPrivateLanIpv4, isValidTablePin, lanGuest, lanName, type Link, type LinkHandlers } from "@tashzone/match";
import { compile } from "@tashzone/engine";
import { getRandomBytes } from "expo-crypto";
import { VERSION_CODE } from "../../lib/env";
import { advertiseTable, connectToHost, localIpAddress, startHostServer, type HostServer } from "../../lib/lan";
import { generateTableName } from "../../lib/lanFormat";
import { beginRun, failWifi, getSession, patchSession, startClient, subscribeSession } from "./session";
import { CLOSE_GRACE_MS, GUEST_FATAL, bufferedLink, formatHostAddress, isDialable, joinFailureCode, lanCompat, makePin } from "./lanLogic";
import type { WifiState } from "./types";

/** A joined guest whose host stays unreachable this long gives up (the host phone slept, left Wi-Fi or closed the app). */
export const HOST_GONE_MS = 45_000;
/** A join that has not produced a table this long after the first attempt gives up. */
export const JOIN_TIMEOUT_MS = 12_000;
const GUEST_MAX_RETRIES = 60;

const randomHex = (bytes: number): string => Array.from(getRandomBytes(bytes), (b) => b.toString(16).padStart(2, "0")).join("");

/* ───────────── host ───────────── */

export interface HostOptions {
  name: string;
  profileId: string;
  gameName: string;
  preset: string;
  settings: Record<string, unknown>;
  /** children's profiles are advertised without their nickname */
  protectedMode: boolean;
}

interface Hosted { table: HostTable | null; server: HostServer | null; stopAdvert: (() => void) | null; unsubscribe: (() => void) | null; rotatePin: (() => void) | null }
let hosted: Hosted | null = null;

const hostWifi = (patch: Partial<WifiState>): WifiState => ({ ...(getSession().wifi ?? { role: "host", pin: null, qr: null, address: null, roster: [], locked: false }), ...patch });

/** Opens a table: rules, PIN, TCP server, mDNS advert and this phone's own seat. Resolves true when the lobby is up. */
export async function hostTable(o: HostOptions): Promise<boolean> {
  const res: Hosted = { table: null, server: null, stopAdvert: null, unsubscribe: null, rotatePin: null };
  hosted = res;
  const cleanup = () => {
    const { table, server, stopAdvert, unsubscribe } = res;
    res.table = null; res.server = null; res.stopAdvert = null; res.unsubscribe = null; res.rotatePin = null;
    if (hosted === res) hosted = null;
    unsubscribe?.();
    stopAdvert?.();
    try { server?.close(); } catch { /* already closed */ }
    table?.close();
  };
  const current = beginRun(o.name, "wifi", cleanup);
  const fail = (code: string): false => { failWifi(current, code); return false; };
  try {
    const compiled = compile(o.profileId, o.settings, o.preset);
    if (!compiled.ok) return fail("ERROR");

    const ip = await localIpAddress();
    if (!current()) return false;
    if (!ip || !isPrivateLanIpv4(ip)) return fail("NO_WIFI");

    const compat = lanCompat(VERSION_CODE);
    let pin = makePin(getRandomBytes);
    const table = new HostTable({
      rules: compiled.rules, effectiveProfileHash: compiled.effective_profile_hash, ...compat, randomHex,
      get pin() { return pin; },
      hostName: lanName(o.name) || "Host",
      onSeatsChanged: () => refreshHost(res, current),
    });
    res.table = table;

    let server: HostServer;
    try {
      server = await startHostServer((link) => acceptGuest(res, link, current));
    } catch {
      return fail("SERVER_FAILED");
    }
    res.server = server;
    if (!current()) { cleanup(); return false; }

    let qr: string;
    try { qr = table.qrPayload(ip, server.port); } catch { return fail("SERVER_FAILED"); }
    const port = server.port;
    res.rotatePin = () => {
      if (!current()) return;
      pin = makePin(getRandomBytes);
      patchSession({ wifi: hostWifi({ pin, qr: table.qrPayload(ip, port) }) });
    };

    patchSession({
      phase: "lobby", profileId: o.profileId, roomCode: table.code, seat: 0, isHost: true, seatCount: table.seats,
      members: table.roster().map((s) => (s.kind === "human" ? s.name : null)),
      wifi: { role: "host", pin, qr, address: formatHostAddress(ip, server.port), roster: table.roster(), locked: false },
    });

    // Nearby phones find the table by mDNS while it is in the lobby; the advert stops as soon as play starts.
    res.stopAdvert = advertiseTable(generateTableName(o.protectedMode ? "" : o.name), server.port, {
      game: o.gameName, hostNickname: o.protectedMode ? "" : o.name, open: table.seats - 1,
    });
    res.unsubscribe = subscribeSession(() => {
      if (getSession().phase !== "lobby" && res.stopAdvert) { const stop = res.stopAdvert; res.stopAdvert = null; stop(); }
    });

    startClient(current, { ...hostSeat(table), ...compat });
    return true;
  } catch {
    return fail("ERROR");
  }
}

/** Wraps a guest connection so the host screen notices wrong-PIN attempts (the table locks after MAX_WRONG_PINS). */
function acceptGuest(res: Hosted, link: Link, current: () => boolean): LinkHandlers {
  const table = res.table;
  if (!table || !current()) { link.close(); return { onText: () => undefined, onClose: () => undefined }; }
  const h = table.accept(link);
  return {
    onText: (t) => { h.onText(t); refreshHost(res, current); },
    onClose: () => h.onClose(),
  };
}

function refreshHost(res: Hosted, current: () => boolean): void {
  const table = res.table;
  if (!table || !current()) return;
  const roster = table.roster();
  const locked = table.wrongPinCount >= MAX_WRONG_PINS;
  const prev = getSession().wifi;
  const members = roster.map((s) => (s.kind === "human" ? s.name : null));
  const same = prev && prev.locked === locked && prev.roster.length === roster.length
    && prev.roster.every((r, i) => r.name === roster[i]!.name && r.kind === roster[i]!.kind && r.online === roster[i]!.online);
  if (same) return; // guests' frames arrive constantly; only real roster/lock changes touch the store
  patchSession({ members, seatCount: table.seats, wifi: hostWifi({ roster, locked }) });
}

/** Host only, lobby: frees an away or unwanted guest's seat (a bot takes it). */
export function kickSeat(seat: number): void {
  const res = hosted;
  if (!res?.table) return;
  res.table.kick(seat);
  res.rotatePin?.();
}

/* ───────────── guest ───────────── */

export type JoinResult = { ok: true } | { ok: false; code: string };

/**
 * Joins a table at a private-LAN address with its PIN. Resolves once the host has seated this phone (the session is then
 * in the lobby), or with a stable code: WRONG_PIN (also a locked table), TABLE_FULL, UPDATE_REQUIRED, UNREACHABLE, ADDRESS_INVALID.
 */
export function joinTable(o: { name: string; host: string; port: number; pin: string }): Promise<JoinResult> {
  if (!isDialable(o.host, o.port) || !isValidTablePin(o.pin)) return Promise.resolve({ ok: false, code: "ADDRESS_INVALID" });
  return new Promise<JoinResult>((resolve) => {
    let settled = false;
    let joined = false;
    let joinTimer: ReturnType<typeof setTimeout> | null = null;
    let goneTimer: ReturnType<typeof setTimeout> | null = null;
    const settle = (r: JoinResult) => { if (settled) return; settled = true; resolve(r); };
    const cleanup = () => {
      if (joinTimer) clearTimeout(joinTimer);
      if (goneTimer) clearTimeout(goneTimer);
      joinTimer = goneTimer = null;
      settle({ ok: false, code: "CANCELLED" });
    };
    const current = beginRun(o.name, "wifi", cleanup);
    const fail = (code: string) => { settle({ ok: false, code }); failWifi(current, code); };

    patchSession({ wifi: { role: "guest", pin: null, qr: null, address: formatHostAddress(o.host, o.port), roster: [], locked: false } });
    const guest = lanGuest(bufferedLink(() => connectToHost(o.host, o.port), CLOSE_GRACE_MS), { pin: o.pin, name: o.name });
    joinTimer = setTimeout(() => { if (!joined) fail("UNREACHABLE"); }, JOIN_TIMEOUT_MS);

    startClient(current, { ...guest, ...lanCompat(VERSION_CODE), maxRetries: GUEST_MAX_RETRIES }, {
      onState: (st) => {
        if (st.status === "offline") { fail(joined ? "HOST_GONE" : "UNREACHABLE"); return; }
        if (st.status !== "reconnecting") return;
        // before the first snapshot a dropped connection means nobody is listening there; afterwards keep trying for a while
        if (!joined) { fail("UNREACHABLE"); return; }
        goneTimer ??= setTimeout(() => fail("HOST_GONE"), HOST_GONE_MS);
      },
      onMessage: (m) => {
        if (goneTimer) { clearTimeout(goneTimer); goneTimer = null; } // any frame proves the host is there
        if (m.type === "TableSnapshot" && !joined) {
          joined = true;
          if (joinTimer) clearTimeout(joinTimer);
          patchSession({ roomCode: m.table_meta.room, phase: getSession().phase === "connecting" ? "lobby" : getSession().phase });
          settle({ ok: true });
        } else if (m.type === "Error" && GUEST_FATAL.has(m.code)) {
          const code = joinFailureCode(m.code);
          fail(joined && code === "WRONG_PIN" ? "KICKED" : code);
        }
      },
    });
  });
}
