/**
 * Adapters between a `Link` (whole JSON texts over TCP) and the `SocketLike` that `MatchClient` speaks, plus an
 * in-memory link for the host's own seat and for tests. See README.md for the wire protocol.
 */
import type { SocketLike } from "../matchClient.js";
import type { Link, LinkHandlers } from "./link.js";

/**
 * Opens one connection. The factory hands `handlers` to the transport (call `onText` per received message and
 * `onClose` once when the connection ends or fails to open) and returns the `Link` to send on. A TCP link that is
 * still connecting must buffer `send` until it is open: `linkSocket` reports "open" right after the factory returns.
 */
export type LinkFactory = (handlers: LinkHandlers) => Link;

/** Sent by the host straight after admission; consumed by `linkSocket`, never shown to `MatchClient`. */
export interface LanSeatedFrame { readonly type: "LanSeated"; readonly seat: number; readonly resume_token: string }

/** What a guest needs across reconnects: the table PIN, its display name and the seat-reclaim token the host issued. */
export interface LanSession { readonly pin: string; readonly name: string; resumeToken: string | null }

export const LAN_JOIN_PREFIX = "lan1";
/** The host's own seat is admitted by `HostTable.acceptHost` and ignores the join token; Hello just needs 10+ chars. */
export const LAN_HOST_JOIN_TOKEN = "lan1:host:self";

/** Guest display names are ASCII, at most 16 characters, and never contain the join-token separator. */
export function lanName(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 16);
}

/** `lan1:<pin>:<resume token or "-">:<name>`. This is the whole PIN gate: it travels in the standard Hello. */
export function lanJoinToken(pin: string, resumeToken: string | null, name: string): string {
  return `${LAN_JOIN_PREFIX}:${pin}:${resumeToken ?? "-"}:${lanName(name)}`;
}

export function linkSocket(open: LinkFactory, session?: LanSession): SocketLike {
  let closed = false;
  const sock: SocketLike = {
    send: (data) => link.send(session ? rewriteHello(data, session) : data),
    close: () => { link.close(); queueMicrotask(fireClose); },
    onopen: null, onmessage: null, onclose: null,
  };
  // `onclose` is always delivered asynchronously and exactly once, so a link that fails inside `open()` still
  // reaches MatchClient after it has attached its callbacks.
  const fireClose = () => { if (closed) return; closed = true; sock.onclose?.({ code: 1006 }); };
  const link = open({
    onText: (text) => {
      if (closed) return;
      if (session && text.startsWith('{"type":"LanSeated"')) {
        const f = parseSeated(text);
        if (f) session.resumeToken = f.resume_token;
        return;
      }
      sock.onmessage?.({ data: text });
    },
    onClose: () => queueMicrotask(fireClose),
  });
  queueMicrotask(() => { if (!closed) sock.onopen?.(); });
  return sock;
}

function rewriteHello(data: string, s: LanSession): string {
  if (!data.startsWith('{"type":"Hello"')) return data;
  try {
    const m = JSON.parse(data) as Record<string, unknown>;
    m.join_token = lanJoinToken(s.pin, s.resumeToken, s.name);
    return JSON.stringify(m);
  } catch { return data; }
}

function parseSeated(text: string): LanSeatedFrame | null {
  try {
    const f = JSON.parse(text) as Partial<LanSeatedFrame>;
    return f.type === "LanSeated" && typeof f.resume_token === "string" && typeof f.seat === "number" ? (f as LanSeatedFrame) : null;
  } catch { return null; }
}

/**
 * A guest's connection settings, ready to spread into `MatchClientOptions`:
 * `new MatchClient({ ...lanGuest(open, { pin, name }), engineBuildHash, behaviourDigest, versionCode, randomSeed })`.
 * The session outlives individual sockets, so MatchClient's automatic reconnect reclaims the same seat.
 */
export function lanGuest(open: LinkFactory, opts: { pin: string; name?: string }) {
  const name = lanName(opts.name ?? "");
  const session: LanSession = { pin: opts.pin, name, resumeToken: null };
  return {
    url: "lan://table",
    joinToken: lanJoinToken(opts.pin, null, name),
    socket: (_url: string): SocketLike => linkSocket(open, session),
    session,
  };
}

/**
 * In-memory link to a table: `accept` is the server end (`table.accept` or `table.acceptHost`). Delivery is
 * asynchronous and ordered; closing either side closes both. Used by `hostSeat` and by tests.
 */
export function memoryLink(accept: (link: Link) => LinkHandlers): LinkFactory {
  return (client) => {
    let closed = false;
    let server: LinkHandlers | null = null;
    const shut = () => {
      if (closed) return;
      closed = true;
      queueMicrotask(() => { server?.onClose(); client.onClose(); });
    };
    const serverLink: Link = {
      send: (t) => { if (!closed) queueMicrotask(() => client.onText(t)); },
      close: shut,
    };
    server = accept(serverLink);
    return {
      send: (t) => { if (!closed) queueMicrotask(() => server?.onText(t)); },
      close: shut,
    };
  };
}
