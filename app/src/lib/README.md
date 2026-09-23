# lib/ — infrastructure

Framework-level plumbing with no UI. `env.ts` holds build-time config (`EXPO_PUBLIC_API_URL`, version code). Logging, storage and telemetry wrappers belong here.

- `lan.ts` — native side of same Wi-Fi play: TCP host/guest `Link`s (length-prefixed frames from `@tashzone/match`), mDNS advertise/scan (NsdManager on Android; never pass `implType`), local IP. Bounded: 8 connections, 64 queued texts, 50 discovered tables, 6 s connect timeout.
- `lanFormat.ts` — pure helpers (table names, TXT records, IPv4 picking) covered by `lanFormat.test.ts`. The PIN is never advertised.
