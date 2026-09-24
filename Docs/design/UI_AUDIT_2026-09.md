# TashZone UI/UX Audit: themes, screens, performance and reliability

**Date:** 2026-09-24
**Scope:** `app/src`, including the uncommitted working tree
**Method:** code audit only; nothing was run on a device. Contrast figures use the WCAG 2.1 formula in `theme/tokens.ts`.
**Theme decision:** ship three themes, all dark: **Emerald, Gold, Dark**. Light (Ivory Silk) is retired. Palette preview: https://claude.ai/artifact/NZh1HDJUUicMF1o2txwRes

Severity levels:
- **P0:** broken, a bug, or a security problem.
- **P1:** a noticeable UX, theme or reliability defect.
- **P2:** polish.

Findings marked *(Light only)* disappear once Light is removed. They are kept here in case Light comes back.

---

## 0. Build health

| Check | Result |
|---|---|
| `tsc --noEmit` | ❌ 1 error. `OptionScreens.tsx:22`: the type `ThemeName \| "system"` is not assignable to `ThemeChoice` (`"gold"` is not accepted). |
| `vitest run` | ✅ 13 test files, 92 tests passing |
| Contrast tests | ⚠ They cover only the `dark` and `light` palettes. Emerald was checked by hand and passes (text 16.5:1, muted 7.4:1, borders 3.8:1). |

---

## 1. Theme implementation: verdict

**Verdict: not correctly implemented.** The palettes themselves meet contrast requirements. What is broken is how the app selects a theme and how components read it.

### P0 findings

1. **The dark-mode styling never runs.** Uncommitted work renamed the theme names to `emerald` and `gold`, and `parsePrefs` never returns `"dark"`. But 13 places still check `name === "dark"`:
   - `_layout.tsx:24` (StatusBar)
   - Screen, GlassCard, Sheet, TabBar, Chip, Keypad, GoldButton, SearchField, SuitBadge, TagPill, CodeCard
   - HomeScreen, MatchSummary, RoomEntry

   As a result, the obsidian vignette, glass cards and gold hairlines from the mehfil design never appear.
2. **The status bar has dark icons on a dark background** in Emerald and Gold, on every screen except the table.
3. **Two theme pickers contradict each other.**
   - The Settings home screen (`SettingsScreen.tsx:150`) offers Emerald, Gold and Ivory, and has no System option.
   - Appearance (`OptionScreens.tsx:14`) offers System, Light and Dark. When the theme is Emerald or Gold, none of its chips shows as selected.
   - Choosing **Dark** writes `name:"dark"`. For the rest of that session this turns on the dead styling over the gold palette. After a restart, `parsePrefs` turns it into **emerald** with flat styling, so the user sees a different theme than the one they picked.
   - Wiping the account also writes `"dark"` (`AccountScreen.tsx:40`).
4. **Wrong-theme flash on cold start.**
   - `ThemeProvider` has no `ready` flag, and `Shell` waits only for the profile to load.
   - `SplashScreen.preventAutoHideAsync` is never called.
   - The splash background is `#0046b8` (blue), which matches no theme.
   - Fonts load without blocking, so text visibly swaps typeface after launch.
5. **Grey flash when navigating.** Neither Stack `contentStyle` nor Tabs `sceneStyle` is set, so the default React Navigation background (`#F2F2F2`) shows through during transitions.

### P1 findings

6. The home picker ignores `prefs.system`: its caption says "Emerald" even when the device's light mode is being followed. Tapping any option silently turns System off.
7. The theme preview on the Settings home screen looks identical for all three themes (`miniCloth` is the same colour in each).
8. `contrast.test.ts` doesn't cover Emerald or the Emerald felt `#0F4A3C`.
9. `hapticStrength`, `sfxVolume` and `ambienceVolume` live in the theme context, so a change to any of them re-renders every themed component. Move them to a separate context.
10. 89 styles use `fontWeight: "600"/"700"` with `fontFamily: "Jost"`, but only Jost 400 is registered under that name (`Jost-SemiBold` is used once). On Android the weight is faked or ignored. Register each weight as its own family, or map weight to family.

### Target design (Emerald / Gold / Dark)

- `ThemeName = "emerald" | "gold" | "dark"`.
- Migrate saved values: `"light"` → `"emerald"`.
- Keep a single picker. Remove System, since there is no light theme to follow.
- Replace every `name === "dark"` check with styling that is always dark. Set StatusBar to `"light"`.
- Add a semantic `accent` token (gold leaf `#E3BD6E`, 10.7–10.9:1 on all three backgrounds).
- **Gold** gets a new warm walnut palette; all its tokens pass (text 16.5:1, muted 6.1:1).
- **Dark** uses the current `gold` tokens (neutral graphite).
- Loop the contrast tests over all three themes.
- Gate the first render on `themeReady && profileReady && fontsLoaded`, then hide the splash screen. Set the splash colour to Emerald `#070F0D`.
- Set `contentStyle` / `sceneStyle` to `c.bg`.

### Light-only defects (all *(Light only)*; fixed by retiring Light)

`material.goldLeaf` (#E3BD6E) is used as text, borders and selection colour on white or cream, at 1.6–1.8:1 contrast. Affected places:
- TabBar active tab
- NavRow icon and chevron
- TagPill gold variant
- SelectableCard selection
- ConfirmSheet markers
- StepDots
- AvatarPicker ring
- Keypad cursor
- SeatRow dashed border
- SuitBadge (`rougeLit` at 2.5:1)
- Most of SettingsScreen (`onTable.*` on cream at 1.0–1.5:1, so the screen is unusable)
- MeScreen passport and streak
- AboutSheet
- Result hero (1.1:1) and podium names (1.0:1)
- TrackerSheet "in your hand"
- Onboarding: Age drum, Name underline, Language star, Welcome wordmark

---

## 2. Cross-cutting issues (not tied to one screen)

| Sev | Area | Finding | Fix |
|---|---|---|---|
| P0 | Reliability | "Try again" reconnect opens a second WebSocket. The old socket isn't closed and its backoff timer still fires (`session.ts:231`, `matchClient.ts:50-71`). | Close the old socket and clear the timer before calling `connect()`. |
| P0 | Reliability | Wi-Fi guests who are dropped (`HOST_GONE` / `KICKED`) land back on `/wifi/join` without being told why. `session.error` is ignored there. | Show `session.error` on WifiJoin. |
| P1 | Error handling | No ErrorBoundary anywhere under `app/`. A `compile()` failure or `SETUP[id]!` in `OfflineTable.tsx:26-58` crashes the whole app. | Add a root ErrorBoundary and route-level boundaries on play and online. |
| P1 | Error handling | `JSON.parse` of server frames has no try/catch (`matchClient.ts:65`), and message shapes aren't validated (`session.ts:192`). | Wrap the parse and validate frames with a schema. |
| P1 | Error handling | Every AsyncStorage failure is swallowed (`ThemeContext.tsx:86,93`, `profile.tsx:33,40`). Corrupt JSON silently resets the profile and restarts onboarding. Writes can also race. | Last-write-wins queue, a one-time warning banner, and debounced writes (the name field writes on every keystroke). |
| P1 | Lifecycle | No `expo-keep-awake` and no `AppState` handling. The host phone can sleep and end the table, and polls keep running in the background. | Call `useKeepAwake()` on the host and table screens, and pause polling while backgrounded. |
| P1 | Offline | Reconnect retries forever with no jitter, and the queue and lobby polls swallow every error, including room-expired. | Cap retries, add jitter, and handle terminal errors with a message. |
| P1 | Back navigation | Android back leaves `/play`, `/wait`, the Wi-Fi host screen and `/match` with no confirmation. Leaving `/match` this way also keeps the host's TCP server open. | Add `useBackAction` with a ConfirmSheet on these routes, and tear down the session. |
| P1 | Settings | Settings that are stored but never used: `orientation`, `sfxVolume`, `ambienceVolume`, `reducedMotion` (**no consumer at all**), `sound.effects`, `parent.online` and `parent.wifi` (**child-safety toggles that do nothing**). | Wire them up or hide them. `reducedMotion` should also follow `AccessibilityInfo`. |
| P1 | Haptics | `utils/sound.ts` only vibrates. `Vibration.vibrate(ms)` ignores the duration on iOS (~400 ms buzz), the master sound switch is ignored, the victory haptic fires on losses too, and it is never triggered during play. The Android `VIBRATE` permission may be missing. | Switch to `expo-haptics` and gate it on `hapticStrength`. |
| P2 | Copy / i18n | Many hard-coded English strings bypass `copy.ts`: Me, SettingsHome, AboutSheet, OnlineTable, QrScanner, GameTile "Solo". Choosing Urdu only mirrors the language screen. Nastaliq isn't applied (`scaleFor` exists but is unused). | Move all strings into copy and apply `scaleFor` for Nastaliq. |
| P2 | Dead code | `services/api.ts` is imported nowhere; `fanLayout` and `MIN_STRIP` are unused; `AtlasScreen` is a dev index reachable by route. | Delete them, or gate behind `__DEV__`. |
| P2 | Performance | `session.set()` notifies every listener on every patch without an equality check. | Add a selector hook. |

---

## 3. Per-screen findings

Each screen lists its **Theme**, **Fit** (no-scroll budget on a 360×740 dp phone), **UX**, **Perf**, **Func** (functionality) and **Err** (error handling) findings.

### Onboarding

**Welcome**
- **Func P0:** the "Continue as {name}" loop. NameScreen assigns a nickname as soon as it mounts. Going back then shows the button, and tapping it redirects to Welcome because `onboarded` is false. Gate the button on `profile.onboarded`.
- **Fit:** fits (~450 dp).

**Language**
- **Func P1:** only the language screen changes; the rest of the app stays English.
- **UX P1:** "اردو" is rendered in Jost instead of Nastaliq, and it will clip at the 17 pt default line height.

**Age**
- **UX P1:** the year defaults to now − 25, so a child who taps straight through is treated as an adult and loses Protected Mode. Require an explicit pick.
- **UX P1:** the year only changes in ±1 steps, so moving 40 years takes 40 taps. Use a snapping FlatList wheel.
- **Fit:** fits (~635 dp).

**Name**
- **UX P2:** no keyboard avoidance, so the keyboard covers the footer button and the avatar grid.
- **UX P2:** "Clear" followed by finish silently picks a random name.
- **Fit:** fits (~663 dp). Trim the 4–5 line note to one line.

**Mode**
- **Perf P2:** `setPrefs({...prefs})` can use stale state. Use a functional update.

### Home
- **Fit P1:** about 1,300 dp, nearly two screens. To fit:
  - Shrink the CardFan (110 → ~60 dp) or remove it.
  - Add a compact one-line `GameTile` (~64 dp) or a horizontal carousel.
  - Merge the two Join rows into one row with **Nearby** and **Room code** chips.
  - Remove Quick-play, which repeats `shelf[0]`.
- **UX P2:** the "last played" label is announced twice by screen readers.
- **Perf P2:** wrap `shelf` in `useMemo` and memoize `GameTile`.

### Games list
- **Perf P2:** 16 tiles rendered with `.map` in a ScrollView. Use FlatList with a memoized tile, and precompute the filter counts.
- **UX P2:** the empty state reads `Nothing called ""` when a filter alone empties the list.
- **Func P2:** the "recent" filter has copy but isn't in `FILTERS`.
- **UX P2:** make search and filters sticky.

### Game detail
- **Err P1:** an unknown id shows only a header, with no body and no way back.
- **Fit:** borderline (~730 dp). Drop the description from 21 pt to 17 pt and put the tags inline with the meta line.

### Ways to play
- **Func P0:** "Pass and play" pushes a bare `/pass`, which shows an empty curtain and then goes back. "Same Wi-Fi" drops the game id. Pass `game`, `name` and `next`.

### Setup
- **Err P1:** an invalid or unplayable id silently redirects to `/games`. Show a toast.
- **Func P1:** `players: 4` is hard-coded. Derive it from `info.players`.

### How to / Rules / Atlas
- **Rules, Fit P1:** two wrapping chip groups take ~250 dp before any rules appear. Use one horizontal chip row.
- **Rules, UX P2:** add an empty state.
- **HowTo:** filters on `status === "play"` instead of `playable()`, and renders an empty Text when there are no rules.
- **Atlas:** an orphan dev screen.

### Table (`/play`)
- **Fit P0:** landscape doesn't fit. `app.json` allows it, but the felt gets about 130 dp when it needs about 265 dp, so the trick is clipped. Either lock portrait or build a landscape layout: cap `cardW` by height and put the MePlate and actions in a side column.
- **Fit P1:** the four action pills in the bottom bar (~300 dp) squeeze the MePlate to ~40 dp. Use 44 dp icon buttons and move Arrange into the menu.
- **Fit P1:** the call/trump tray sits at a hard-coded `bottom:110` and covers the hand. Position it from the hand's measured height.
- **Fit P2:** `isCompact = height < 740` is exactly the target device height, so compact mode flips depending on the device.
- **Perf P1:** the 250 ms turn-clock `setState` re-renders the whole table (model, seats, hand, 13 PanResponders) four times a second. Isolate `<ClockBar>`, `React.memo` Hand, Seat and PlayingCard, and memoize callbacks.
- **UX P1:** the Bhabhi red flash animates `borderColor` on a view with no `borderWidth`, so it never shows.
- **UX P1:** `reducedMotion` is ignored by the felt breathing, seat pulse, card lift and sheets.
- **Err P2:** if the clock expires and `hint()` returns null, the turn stalls.

### Hand / PlayingCard
- **Func P1 (regression):** the "Spread" arrangement does nothing when you hold more than 6 cards. The two-row fallback is gone, so 13 cards at 360 dp gives a ~25 dp touch strip per card (below 44).
- **Func P1:** the armed (selected) card is never cleared. It stays raised when the turn changes and plays on a single tap next turn.
- **Perf P1:** `onPress` is new on every render and is a `useMemo` dependency, so 13 PanResponders are rebuilt four times a second, which can drop a gesture mid-swipe.
- **Err P2:** duplicate cards (two decks) share the armed state, and index keys remount slots.
- **Err P2:** a tap during the 140 ms swipe animation plays the card twice.
- **UX P2:** accessibility says "disabled" on cards that can still be pressed, and there's no hint for "tap twice to play".

### Controls
- **Theme P0:** the trump picker draws ♠ and ♣ at `#1A1A1A` on a dark tray (1.1:1), so they're invisible. It also ignores the four-colour setting.
- **UX P2:** call buttons are 42 dp and strip buttons 34 dp, both below 44 dp. Use a 7×2 grid for the call picker instead of horizontal scrolling.

### Table sheets
- **Fit P2:** in landscape, `maxHeight 80%` leaves ~100 dp for the menu. Use a side panel with `maxWidth` 520.
- **Func:** the Spread option in ArrangeSheet is a no-op.

### Result screens
- **Theme P0:** the 2nd- and 3rd-place podium score and rank have no colour set, so they default to black on near-black and are invisible.
- **UX P1:** "Leave the match" has no confirmation.
- **UX P1:** the victory haptic fires on losses and ignores the haptic settings.
- **UX P2:** emoji in labels are read aloud by screen readers.
- **Fit P2:** Callbreak results overflow 740 dp. Reduce hero padding and drop confetti in compact mode.

### Room entry (`/room`)
- **Fit P1:** ~770 dp. Add a Join / Create / Quick segmented control at the top, and move rules and length into a summary sheet.
- **UX P1:** no keyboard avoidance, so the keyboard hides the Join button.
- **UX P2:** `maxLength 12` for what is a 6-character code.
- **UX P2:** navigating away mid-request still redirects to `/wait` later.

### Wait room
- **Fit P1:** ~740 dp. The mini-stage duplicates SeatList; keep one.
- **UX P1:** back leaves with no confirmation.
- **UX P2:** no "connecting…" state.
- **Perf P2:** HTTP poll every 3 s on top of the socket, even in the background.

### Online table
- **Fit P1:** banners stack in the layout and shrink the felt. Use a single overlay.
- **UX P1:** confusing reconnect copy.
- **UX P1:** no countdown to the 45 s host-gone cutoff.
- **Func P2:** the "update required" banner has no action.

### Match summary
- **Func P1:** Wi-Fi tables get wrong copy ("server update … room still open") and no rematch option.
- **Err P1:** leaving with back skips teardown.
- **Err P2:** a ref-based record guard can record the result twice after a remount.

### Wi-Fi host
- **Fit P1:** ~950 dp. Put a 140 dp QR beside the PIN and show seats as chips.
- **UX P1:** Close and back end the table for everyone with no confirmation.
- **Func P1:** online guests can't be removed. Removal isn't a ban (a removed guest rejoins with the PIN), and the PIN can't be rotated.
- **Security P2:** 10 wrong PINs lock the whole table, which lets anyone on the LAN block it. The server listens on `0.0.0.0`.

### Wi-Fi join / PIN
- **Err P0:** `session.error` isn't shown (see §2).
- **UX P1:** the address field uses SearchField, so the wrong keyboard appears and there's no keyboard avoidance.
- **UX P1:** the address is only validated after all four PIN digits, which then get wiped. Validate the address first.
- **Func P2:** no `app/wifi/index` route, so a QR scanned with the system camera leads to an unmatched route.
- **Fit P2:** shrink keys from 64 to 56 dp.

### Settings home
- **Fit P1:** ~1,400 dp across 12 blocks with duplicates: theme is also in Appearance, the four-colour deck is also in Appearance, stats are also on Me, and the quick pills repeat the sub-pages. Collapse to:
  - a profile row
  - Look & table
  - Play & sound
  - Family & data
  - About
- **Func P0:** "Export JSON" and "Clear Cache" show success toasts but do nothing. The "100%" figure is hard-coded. Remove them; Account already has a real backup.
- **UX P1:** segment items, pills and toggles are 20–30 dp tall and text is 10–11.5 pt. Raise them to 44 dp and 13 pt minimum, and use the `radio` / `switch` accessibility roles.
- **Perf P2:** the large single component re-renders on every preference change.

### Appearance / Themes
- **P0:** see §1.3 (two pickers).
- **Themes, Func P2:** table designs are preview-only ("soon"); that's shown honestly.

### Parent controls
- **Func P0:** the `online` and `wifi` toggles have no effect anywhere.
- **Security P1:** a 4-digit PIN with a flat 5 tries per 60 s gives ~17 h of brute force on average, and `Date.now()` can be bypassed by changing the device clock. Add escalating lockouts, consider 6 digits, and use a monotonic clock.
- **UX P2:** "Remove PIN" has no confirmation.
- **Err P2:** unhandled rejections from `makePinRecord` / `digestStringAsync`.

### Account
- **UX P1:** without a PIN, wipe is a single gold (primary) button. Use ConfirmSheet with the destructive action as the outlined button.
- **Good:** export strips the PIN hash, and restore keeps the parent fields.

### Me
- **Func P2:** hard-coded English ("Mehfil Ustad", "MEHFIL PASSPORT", the streak line).
- **Theme:** the `onTable.gold` issues are *(Light only)*.

### About sheet
- **Func P1:** says "Sixteen games / 16 classics", but the catalogue has 8, of which 4 are playable.
- **Func P1:** no privacy policy, licences (OFL fonts) or support contact, which the stores require.

---

## 4. Recommended fix order

| # | Work | Covers |
|---|---|---|
| 1 | **Theme foundation.** Three dark themes; one picker; remove `name === "dark"`; StatusBar light; `accent` token; ready-gating plus splash; nav background; fix the typecheck error; contrast tests for all three themes. | §1 all |
| 2 | **Broken flows.** Welcome loop; Ways → pass/wifi params; trump suit glyphs; podium text colour; Wi-Fi drop reason; duplicate reconnect socket. | P0s |
| 3 | **Honesty.** Remove fake Export/Clear; wire or hide dead toggles (parent, orientation, reducedMotion, volumes); fix About copy. | Trust and child safety |
| 4 | **Crash-proofing.** ErrorBoundary; safe frame parse; storage write queue; back-button confirmations with teardown; keep-awake on the host. | Reliability |
| 5 | **Table performance.** Isolate the clock; memo Hand, Seat and Card; stable callbacks; reset the armed card; restore two-row/Spread. | Frame rate, input |
| 6 | **No-scroll pass.** Home, Settings home, Room, Wi-Fi host, Rules; landscape table (or lock portrait). | Compactness |
| 7 | **Polish.** Haptics via expo-haptics; 44 dp targets; i18n and Nastaliq; FlatLists; accessibility labels. | P2s |

---

## 5. Implementation status (branch `feats/themes-setup`, 2026-09-24)

| Step | Status | Commit |
|---|---|---|
| 1. Theme foundation: three rooms (Mehfil, Darbar, Arcade), single picker, fonts, splash, nav background, contrast tests | Done | `758b431` |
| 2. Broken flows (Welcome loop, Ways, trump suits, podium text, Wi-Fi drop reason, duplicate socket) | Done | `fed81ff`, `630db9a`, `d2bc19b` |
| 3. Honesty (fake Export/Clear removed, parent toggles wired, About copy, dead settings wired) | Done | `758b431`, `d2bc19b` |
| 4. Motion, haptics, sound per room; re-dye switch transition | Done | `630db9a`, `afc94a6` |
| 5. Crash-proofing, table performance, no-scroll layouts, landscape, polish | Done except items below | all of the above |

**Still open**
- Full translation: only onboarding Language renders Urdu correctly; other screens are English (strings are now in `copy.ts` files, ready for translation).
- Pass-and-play is shown as "Coming soon": the engine table seats one human against bots.
- Wi-Fi guest removal rotates the PIN; a per-device ban needs a `HostTable` change.
- Parent PIN lockout only counts down while the app is running.
- Needs device verification: landscape fit, sheet side panel, haptic/sound timing, two-phone Wi-Fi flows, keep-awake, iOS swipe-back block.
- Native rebuild required: `expo-haptics`, `expo-audio`, `expo-screen-orientation`, `expo-keep-awake` were added.
