import { useProfile } from "../store/profile";

/** Whether Parent Settings currently allow a connected mode. `online` = internet rooms and Quick Match, `wifi` = same-network tables. */
export function useParentGate(kind: "online" | "wifi"): { allowed: boolean } {
  const { profile } = useProfile();
  return { allowed: profile.parent[kind] };
}
