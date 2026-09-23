# features/me

You tab (`app/(tabs)/me.tsx`).

- `MeScreen.tsx`: identity card, all-time stats (`profile.stats`, real), win rate, recent games (`profile.recent`), empty state before the first match.
- `AvatarSheet.tsx`: avatar grid (`components/ui/AvatarPicker`) and name editor; saves to the local profile.
- `copy.ts`: every string on these screens.

Not built: badges, XP and level, per-game records (the profile stores only totals and a recent-games list).
