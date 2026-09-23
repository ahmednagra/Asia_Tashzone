import { useSyncExternalStore } from "react";
import { getSession, subscribeSession, type SessionState } from "../features/multiplayer/session";

/** Live view of the app's single online session (room, queue or table). */
export function useOnlineSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}
