import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_PROFILE, type Profile, mergeProfile } from "./profileModel";

// the pure model lives in profileModel.ts (unit-tested without React Native); re-exported so imports stay stable
export { DEFAULT_PROFILE, mergeProfile };
export type { Lang, PinLock, Profile } from "./profileModel";

const KEY = "tashzone.profile.v1";

interface Ctx {
  profile: Profile;
  /** false until the saved profile has been read; gate first render on it */
  ready: boolean;
  update: (patch: Partial<Profile>) => void;
  /** records a finished match: bumps matches, wins and streak, `bhabhi` when the player lost Bhabhi, and the recent list */
  recordResult: (gameId: string, won: boolean, lostBhabhi?: boolean) => void;
  reset: () => void;
}

const ProfileCtx = createContext<Ctx>({ profile: DEFAULT_PROFILE, ready: false, update: () => {}, recordResult: () => {}, reset: () => {} });

/** On-device player profile, saved to AsyncStorage. No account, nothing leaves the phone (offline-first). */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);
  const latest = useRef(profile);
  latest.current = profile;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) setProfile(mergeProfile(JSON.parse(v))); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const commit = useCallback((next: Profile) => {
    setProfile(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  const update = useCallback((patch: Partial<Profile>) => commit({ ...latest.current, ...patch }), [commit]);
  const recordResult = useCallback((gameId: string, won: boolean, lostBhabhi = false) => {
    const p = latest.current;
    commit({
      ...p,
      stats: { matches: p.stats.matches + 1, wins: p.stats.wins + (won ? 1 : 0), streak: won ? p.stats.streak + 1 : 0, bhabhi: p.stats.bhabhi + (lostBhabhi ? 1 : 0) },
      recent: [gameId, ...p.recent.filter((g) => g !== gameId)].slice(0, 5),
    });
  }, [commit]);
  const reset = useCallback(() => commit(DEFAULT_PROFILE), [commit]);

  const value = useMemo(() => ({ profile, ready, update, recordResult, reset }), [profile, ready, update, recordResult, reset]);
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export const useProfile = () => useContext(ProfileCtx);
