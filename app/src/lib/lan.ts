import type { Link, LinkHandlers } from '@tashzone/match';
import { FrameDecoder, encodeFrame } from '@tashzone/match';
import * as Network from 'expo-network';
import TcpSocket from 'react-native-tcp-socket';
import Zeroconf, { type ZeroconfService } from 'react-native-zeroconf';
import { buildTxt, parseService, type NearbyTable, type TableInfo } from './lanFormat';

/**
 * Native side of same Wi-Fi play: TCP sockets carrying length-prefixed frames, and mDNS discovery.
 * Everything above this file only sees text `Link`s, so the table logic is tested without phones.
 *
 * Bounds: at most MAX_CONNECTIONS live sockets on the host; the frame decoder rejects any frame over its cap
 * (the socket is closed); texts that arrive before the owner has attached handlers are queued up to
 * MAX_PENDING_TEXTS, then the link is closed; the discovered-table list is capped at MAX_TABLES.
 */

export type { NearbyTable, TableInfo } from './lanFormat';

const SERVICE_TYPE = 'tashzone';
const SERVICE_PROTOCOL = 'tcp';
const SERVICE_DOMAIN = 'local.';
const CONNECT_TIMEOUT_MS = 6000;
const MAX_CONNECTIONS = 8;
const MAX_PENDING_TEXTS = 64;
const MAX_TABLES = 50;

type Socket = ReturnType<typeof TcpSocket.createConnection>;

/** A link whose handlers are attached by the owner once it has them (texts received meanwhile are queued). */
export interface WiredLink {
  link: Link;
  wire: (handlers: LinkHandlers) => void;
}

function linkFromSocket(socket: Socket): WiredLink {
  const decoder = new FrameDecoder();
  let handlers: LinkHandlers | null = null;
  const pending: string[] = [];
  let closed = false;
  socket.setNoDelay(true);
  const close = () => {
    if (closed) return;
    closed = true;
    pending.length = 0;
    try {
      socket.destroy();
    } catch {
      // already gone
    }
    handlers?.onClose();
  };
  socket.on('data', (data) => {
    if (closed) return;
    try {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      for (const text of decoder.push(bytes)) {
        if (handlers) handlers.onText(text);
        else if (pending.length < MAX_PENDING_TEXTS) pending.push(text);
        else return close();
      }
    } catch {
      close(); // oversized or corrupt frame
    }
  });
  socket.on('error', close);
  socket.on('close', close);
  return {
    link: {
      send: (text) => {
        if (closed) return;
        try {
          socket.write(encodeFrame(text));
        } catch {
          close(); // oversized message or dead socket
        }
      },
      close,
    },
    wire: (h) => {
      handlers = h;
      for (const text of pending.splice(0)) h.onText(text);
      if (closed) h.onClose();
    },
  };
}

export interface HostServer {
  port: number;
  close: () => void;
}

/**
 * Listens on a free port on the local network. Each connection is handed to `accept`, which returns the handlers
 * for that link. Connections beyond MAX_CONNECTIONS are dropped at once.
 */
export function startHostServer(accept: (link: Link) => LinkHandlers): Promise<HostServer> {
  return new Promise((resolve, reject) => {
    const sockets = new Set<Socket>();
    let listening = false;
    const server = TcpSocket.createServer((raw) => {
      const socket = raw as Socket;
      if (sockets.size >= MAX_CONNECTIONS) {
        socket.destroy();
        return;
      }
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      const { link, wire } = linkFromSocket(socket);
      wire(accept(link));
    });
    server.on('error', (error) => {
      if (!listening) reject(error);
    });
    server.listen({ port: 0, host: '0.0.0.0' }, () => {
      const address = server.address();
      if (!address) return reject(new Error('server has no address'));
      listening = true;
      resolve({
        port: address.port,
        close: () => {
          for (const s of sockets) s.destroy();
          sockets.clear();
          server.close();
        },
      });
    });
  });
}

/** Connects to a host. Resolves once the TCP connection is open (rejects after 6 s). Attach handlers with `wire`. */
export function connectToHost(host: string, port: number): Promise<WiredLink> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = TcpSocket.createConnection({ host, port }, () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(linkFromSocket(socket));
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error('timeout'));
    }, CONNECT_TIMEOUT_MS);
    socket.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(error);
    });
  });
}

/** This device's IPv4 address on the Wi-Fi network, or null when offline / not on a LAN. */
export async function localIpAddress(): Promise<string | null> {
  try {
    const ip = await Network.getIpAddressAsync();
    return ip && ip !== '0.0.0.0' ? ip : null;
  } catch {
    return null;
  }
}

let zeroconf: Zeroconf | null = null;
const getZeroconf = () => (zeroconf ??= new Zeroconf());

/**
 * Every call below deliberately omits the `implType` argument, so Android uses NsdManager, the system's own mDNS.
 * Do not pass 'DNSSD'.
 */

/** Advertises the table. The PIN is never advertised: players read it from the host's screen. Returns a stop function. */
export function advertiseTable(name: string, port: number, info: TableInfo): () => void {
  const z = getZeroconf();
  let published = false;
  try {
    z.publishService(SERVICE_TYPE, SERVICE_PROTOCOL, SERVICE_DOMAIN, name, port, buildTxt(info));
    published = true;
  } catch {
    // discovery is best effort; the QR code still works
  }
  return () => {
    if (!published) return;
    published = false;
    try {
      z.unpublishService(name);
    } catch {
      // already stopped
    }
  };
}

/** Finds tables on the same network. `onChange` gets the full current list each time. Returns a stop function. */
export function scanForTables(onChange: (tables: NearbyTable[]) => void, onError?: (error: unknown) => void): () => void {
  const z = getZeroconf();
  const tables = new Map<string, NearbyTable>();
  let stopped = false;
  const emit = () => {
    if (!stopped) onChange([...tables.values()]);
  };
  const onResolved = (service: ZeroconfService) => {
    const table = parseService(service);
    if (!table) return;
    if (!tables.has(table.name) && tables.size >= MAX_TABLES) return;
    tables.set(table.name, table);
    emit();
  };
  const onRemoved = (name: string) => {
    if (tables.delete(name)) emit();
  };
  const onFailure = (error: unknown) => onError?.(error);
  z.on('resolved', onResolved);
  z.on('remove', onRemoved);
  z.on('error', onFailure);
  try {
    z.scan(SERVICE_TYPE, SERVICE_PROTOCOL, SERVICE_DOMAIN);
  } catch (error) {
    onError?.(error);
  }
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      z.stop();
    } catch {
      // already stopped
    }
    z.removeListener('resolved', onResolved);
    z.removeListener('remove', onRemoved);
    z.removeListener('error', onFailure);
  };
}
