# features/settings

Settings tab and its sub-screens, all composed from `components/ui/Settings.tsx` (`SettingsScreen`, `SettingsGroup`) with `NavRow`, `ToggleRow`, `ChipGroup`.

- `SettingsScreen.tsx`: `SettingsHome` (tab).
- `OptionScreens.tsx`: appearance (theme, deck, motion via `usePrefs`), playing, sound (switches stored only: no audio or haptics playback exists yet).
- `ParentScreens.tsx`: parent switches and PIN set/change. `hooks/usePinGate.ts` does the check.
- `pin.ts` (pure, tested) and `pinCrypto.ts` (expo-crypto SHA-256 + random salt): the PIN is stored as `SHA-256(salt:pin)`; 5 wrong tries lock it for 60 s, persisted in `profile.parent.lock`.
- `AccountScreen.tsx`: no account exists. Real text backup (Share) and restore (paste), and delete-everything (asks for the parent PIN when one is set). Restore never changes parental controls.
- `ThemesScreen.tsx`: table designs preview, marked coming soon; the table does not render them.
- `copy.ts`: every string.

Storage: profile `tashzone.profile.v1` (`store/profileModel.ts` is the pure, tested model), theme prefs `tashzone.theme.v1`.
