import type { Profile } from "../../store/profileModel";
import type { MeView, ProgressBody, ProgressView } from "../../types/api";

const NAME_MAX = 24;

export function toProgress(stats: Profile["stats"]): ProgressBody {
  const wins = Math.min(stats.wins, stats.matches);
  return {
    xp: 0,
    matches: stats.matches,
    wins,
    hands_played: stats.bhabhi,
    first_out: 0,
    times_bhabhi: stats.bhabhi,
    best_streak: Math.min(stats.streak, wins),
    badges: [],
    games: {},
  };
}

export function fromServer(me: MeView, progress: ProgressView, current: Profile): Profile {
  return {
    ...current,
    onboarded: true,
    name: me.display_name.slice(0, NAME_MAX) || current.name,
    avatar: me.avatar_id,
    stats: { matches: progress.matches, wins: progress.wins, streak: 0, bhabhi: progress.times_bhabhi },
  };
}
