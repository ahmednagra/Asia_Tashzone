/**
 * Same Wi-Fi play carries the online protocol over a plain TCP link instead of a WebSocket. Everything above the
 * socket only sees whole JSON texts, so the host table and the guests are tested with in-memory links and the app
 * supplies the real TCP one (app/src/lib/lan.ts).
 */

/** One connection, carrying whole JSON messages. */
export interface Link {
  send(text: string): void;
  close(): void;
}

export interface LinkHandlers {
  onText(text: string): void;
  onClose(): void;
}
