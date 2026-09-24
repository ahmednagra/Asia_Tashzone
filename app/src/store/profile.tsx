import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_PROFILE, type Profile, mergeProfile } from "./profileModel";
import { lockRemaining, settleLock, storedLock } from "../features/settings/pin";

// the pure model lives in profileModel.ts (unit-tested without React Native); re-exported so imports stay stable
export { DEFAULT_PROFILE, mergeProfile };
export type { Lang, PinLock, Profile } from "./profileModel";

const KEY = "tashzone.profile.v1";
const BACKUP_KEY = "tashzone.profile.v1.unreadable";
const WRITE_DELAY_MS = 300;
const LOCK_SAVE_MS = 15_000;
const READ_TRIES = 3;
const READ_RETRY_MS = 150;

export const monoNow = () => performance.now();

interface Ctx {
  profile: Profile;
  /** false until the saved profile has been read; gate first render on it */
  ready: boolean;
  storageError: boolean;
  update: (patch: Partial<Profile>) => void;
  /** records a finished match: bumps matches, wins and streak, `bhabhi` when the player lost Bhabhi, and the recent list */
  recordResult: (gameId: string, won: boolean, lostBhabhi?: boolean) => void;
  reset: () => void;
}

const ProfileCtx = createContext<Ctx>({ profile: DEFAULT_PROFILE, ready: false, storageError: false, update: () => {}, recordResult: () => {}, reset: () => {} });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toStored(p: Profile, mono: number): Profile {
  const lock = p.parent.lock;
  return lock ? { ...p, parent: { ...p.parent, lock: storedLock(lock, mono) } } : p;
}

function parseStored(raw: string): Profile | null {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? mergeProfile(v) : null;
  } catch {
    return null;
  }
}

/** On-device player profile, saved to AsyncStorage. No account, nothing leaves the phone (offline-first). */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const latest = useRef(profile);
  const touched = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!dirty.current) return;
    dirty.current = false;
    const json = JSON.stringify(toStored(latest.current, monoNow()));
    writes.current = writes.current.then(() => AsyncStorage.setItem(KEY, json)).catch(() => setStorageError(true));
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      let raw: string | null = null;
      let read = false;
      for (let i = 0; i < READ_TRIES && !read; i++) {
        try {
          raw = await AsyncStorage.getItem(KEY);
          read = true;
        } catch {
          await wait(READ_RETRY_MS);
        }
      }
      if (!live) return;
      if (!read) setStorageError(true);
      else if (raw !== null) {
        const saved = parseStored(raw);
        if (!saved) {
          const copy = raw;
          writes.current = writes.current.then(() => AsyncStorage.setItem(BACKUP_KEY, copy)).catch(() => {});
          setStorageError(true);
        } else if (!touched.current) {
          const lock = saved.parent.lock;
          const next = lock && lock.left > 0 ? { ...saved, parent: { ...saved.parent, lock: { ...lock, mark: monoNow() } } } : saved;
          latest.current = next;
          setProfile(next);
        }
      }
      setReady(true);
    })();
    return () => { live = false; };
  }, []);

  const commit = useCallback((next: Profile, now = false) => {
    touched.current = true;
    latest.current = next;
    dirty.current = true;
    setProfile(next);
    if (now) flush();
    else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, WRITE_DELAY_MS);
    }
  }, [flush]);

  const update = useCallback((patch: Partial<Profile>) => commit({ ...latest.current, ...patch }, "parent" in patch || "onboarded" in patch || "tutorialDone" in patch), [commit]);
  const recordResult = useCallback((gameId: string, won: boolean, lostBhabhi = false) => {
    const p = latest.current;
    commit({
      ...p,
      stats: { matches: p.stats.matches + 1, wins: p.stats.wins + (won ? 1 : 0), streak: won ? p.stats.streak + 1 : 0, bhabhi: p.stats.bhabhi + (lostBhabhi ? 1 : 0) },
      recent: [gameId, ...p.recent.filter((g) => g !== gameId)].slice(0, 5),
    }, true);
  }, [commit]);
  const reset = useCallback(() => commit(DEFAULT_PROFILE, true), [commit]);

  const locked = (profile.parent.lock?.left ?? 0) > 0;
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => {
      const p = latest.current;
      const lock = p.parent.lock;
      if (!lock) return;
      const mono = monoNow();
      if (lockRemaining(lock, mono) > 0) { dirty.current = true; flush(); }
      else commit({ ...p, parent: { ...p.parent, lock: settleLock(lock, mono) } }, true);
    }, LOCK_SAVE_MS);
    return () => clearInterval(id);
  }, [locked, flush, commit]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      if (latest.current.parent.lock?.left) dirty.current = true;
      flush();
    });
    return () => { sub.remove(); flush(); };
  }, [flush]);

  const value = useMemo(() => ({ profile, ready, storageError, update, recordResult, reset }), [profile, ready, storageError, update, recordResult, reset]);
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export const useProfile = () => useContext(ProfileCtx);
