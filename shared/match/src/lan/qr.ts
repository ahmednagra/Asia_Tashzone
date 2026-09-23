/**
 * QR contents for joining a same-Wi-Fi table without discovery: `tashzone://wifi?h=<ip>&p=<port>&k=<pin>`.
 * A scanned code is untrusted input, so it may only ever point at a private-LAN IPv4 address: never the internet.
 */
export interface TableQr { readonly host: string; readonly port: number; readonly pin: string }

const PIN = /^\d{4}$/;
const QR = /^tashzone:\/\/wifi\?h=(\d{1,3}(?:\.\d{1,3}){3})&p=(\d{1,5})&k=(\d{4})$/;

/** Private-LAN IPv4 only: 10/8, 172.16/12, 192.168/16 and link-local 169.254/16. Canonical dotted quads (no leading zeros). */
export function isPrivateLanIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const o: number[] = [];
  for (const p of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(p)) return false;
    const n = Number(p);
    if (n > 255) return false;
    o.push(n);
  }
  const [a, b] = o as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export function isValidTablePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1024 && port <= 65535;
}

export function isValidTablePin(pin: string): boolean { return PIN.test(pin); }

/** Throws on anything `parseTableQr` would refuse, so the host can never display a code guests would reject. */
export function tableQrPayload(host: string, port: number, pin: string): string {
  if (!isPrivateLanIpv4(host)) throw new Error("table host must be a private LAN IPv4 address");
  if (!isValidTablePort(port)) throw new Error("table port must be 1024-65535");
  if (!isValidTablePin(pin)) throw new Error("table PIN must be 4 digits");
  return `tashzone://wifi?h=${host}&p=${port}&k=${pin}`;
}

export function parseTableQr(text: string): TableQr | null {
  const m = QR.exec(text.trim());
  if (!m) return null;
  const host = m[1]!;
  const port = Number(m[2]);
  if (!isPrivateLanIpv4(host) || !isValidTablePort(port)) return null;
  return { host, port, pin: m[3]! };
}
