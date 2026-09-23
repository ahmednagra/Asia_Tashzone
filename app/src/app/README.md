# app/ — routes

Expo Router file-based routes. Each file is one screen URL; keep them thin: read params, wire navigation, render a component from `features/`.

| File | URL | Renders |
|---|---|---|
| `_layout.tsx` | (all) | Fonts, `ThemeProvider`, status bar, stack |
| `index.tsx` | `/` | Home (game list) |
| `settings.tsx` | `/settings` | Display preferences |
| `play/[game].tsx` | `/play/<gameId>` | Setup sheet, then the offline table |
| `online/[game].tsx` | `/online/<gameId>` | Online room: create, join, lobby, table |

Deep link scheme: `tashzone://` (see `app.json`). Add new screens here, not in `features/`.
