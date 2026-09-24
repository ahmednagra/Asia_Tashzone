# 05 — Deployment Runbook

**TashZone · Run, release, back up and rebuild the backend; build the app against it**
Version 2.0 · 22 Sep 2026 · Architecture: `03_PLATFORM.md`. Release gates: `04_QUALITY_RELEASE_ROADMAP.md` §5. Hosting decision L31 and local-progression decision L38 are in `02-product-brief.md`; store forms in `08-store-compliance.md`.

**Conventions.** **PC** blocks run in Windows Terminal / PowerShell (not PowerShell ISE). **Server** blocks run over SSH (`ubuntu@tashzone-vnic:~$`). Never paste secret values into chat, documents or git. **Planned** marks a required change not yet implemented.

---

## Part A: Live environment

| Item | Value |
|---|---|
| Cloud | Oracle Cloud Always Free, tenancy/compartment `ahmednagra9 (root)`, region Mumbai `AP-MUMBAI-1-AD-1` |
| Instance | `tashzone-prod`, VM.Standard.A1.Flex, 1 OCPU / 6 GB, Ubuntu 24.04 arm64, hostname `tashzone-vnic`, 4 GB swap |
| IPs | public **141.148.193.78** (ephemeral — lost on terminate); private 10.0.0.251 |
| Boot volume | 100 GB, 10 VPU (of 200 GB tenancy allowance) |
| Network | VCN `tashzone-vcn` 10.0.0.0/16; public subnet 10.0.0.0/24 |
| Open ports | 22/tcp, 80/tcp, 443/tcp+udp, 7881/tcp, 7882/udp, ICMP — in both the security list and host iptables |
| SSH | user `ubuntu`, key `C:\Users\Muhammad Ahmed\.ssh\tashzone.key` (offline backup kept) |
| Endpoints | API `https://api.141-148-193-78.sslip.io` (`/health`) · match `wss://match.141-148-193-78.sslip.io` · voice `wss://voice.141-148-193-78.sslip.io` |
| Paths | code `/srv/tashzone/repo` · secrets `/srv/tashzone/.env` (chmod 600) · backups `/srv/tashzone/backups` · APKs `/srv/tashzone/releases` |
| Match-server scale | `INSTANCE_ID` (default `match-server-1`), `INSTANCE_URL` (empty = single instance; must be `ws://` or `wss://`) |
| Backups | nightly dump 03:30 UTC, 14 days, local only |
| Containers | `postgres`, `api-migrate` (runs once), `api`, `room-maintenance`, `match-server`, `livekit`, `caddy` |

**State (18 Sep 2026):** code from 17 Sep 08:00 UTC; database on migration `7adbbd5139ef` with four pending; only `postgres`, `api`, `match-server`, `caddy` running. `room-maintenance` and `livekit` start with the next deploy (J1).

**Verified 17 Sep 2026:** `/health` ok; player creation writes to PostgreSQL; a scripted two-player online Callbreak match ran end to end (registration, room, join tokens, host start, bot fill, result and stats saved).

```
Phone ──https──> Caddy :443 ─> api:8080 ─> postgres:5432
  ├────wss────> Caddy :443 ─> match-server:8787 ─(internal token)─> api
  ├────wss────> Caddy :443 ─> livekit:7880            (voice signalling)
  └────srtp───> host :7881/tcp, :7882/udp ──────> livekit   (voice media, never through Caddy)
```

---

## Part B: Server setup from zero (about one hour)

### B1. Network (Oracle console)
Create the network before the instance.
1. Menu → **Networking → Virtual cloud networks** → compartment `ahmednagra9 (root)` → **Start VCN Wizard → Create VCN with Internet Connectivity**, name `tashzone-vcn`, defaults → **Create**.
2. **Security → Default Security List → Add Ingress Rules** (stateful, source `0.0.0.0/0`):

| Protocol | Port | Purpose |
|---|---|---|
| TCP | 80 | HTTP redirect, ACME |
| TCP | 443 | HTTPS, WebSocket |
| UDP | 443 | HTTP/3 |
| TCP | 7881 | voice ICE/TCP fallback |
| UDP | 7882 | voice media |

Keep egress allow-all. Never open 5432, 8080, 8787 or 7880. Narrow SSH to your own address if fixed. Use network security groups (same rule fields) once there is more than one instance.

### B2. Instance (Oracle console)
**Compute → Instances → Create:** name `tashzone-prod`, **On-demand**; Canonical Ubuntu 24.04; shape **Ampere VM.Standard.A1.Flex** showing *Always Free-eligible* (tenancy allowance 2 OCPU / 12 GB); VNIC `tashzone-vnic`, existing VCN and public subnet, **public IPv4 on**; **Generate key pair → download private key** once; boot volume 100 GB, 10 VPU. "Out of host capacity" → retry later or Pay As You Go.

### B3. Key file (PC)
```powershell
icacls "C:\Users\Muhammad Ahmed\.ssh\tashzone.key" /inheritance:r /grant:r "$($env:USERNAME):R"
```
```powershell
ssh -i "C:\Users\Muhammad Ahmed\.ssh\tashzone.key" ubuntu@141.148.193.78
```

### B4. Prepare the server (Server)
```bash
sudo apt update && sudo apt -y upgrade && sudo apt -y install unattended-upgrades git
```
Host firewall — insert **above** the final REJECT (find the index; never hard-code it):
```bash
R=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/ {print $1; exit}')
sudo iptables -I INPUT $R -m state --state NEW -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT $R -m state --state NEW -p tcp --dport 443 -j ACCEPT && sudo iptables -I INPUT $R -p udp --dport 443 -j ACCEPT && sudo iptables -I INPUT $R -m state --state NEW -p tcp --dport 7881 -j ACCEPT && sudo iptables -I INPUT $R -p udp --dport 7882 -j ACCEPT && sudo netfilter-persistent save
```
**Never use `ufw`** on Oracle images (it removes the iSCSI boot-volume rules and the next boot fails). Without `netfilter-persistent`, edit `/etc/iptables/rules.v4` and run `sudo iptables-restore < /etc/iptables/rules.v4`; keep a `.bak` copy.
```bash
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu
```
```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
Log out and in, then `docker run --rm hello-world`. Reboot if the login message asks.

### B5. Code and secrets
PC:
```powershell
cd D:\CardGame
tar --exclude=node_modules --exclude=.expo --exclude=.venv --exclude=dist --exclude=.turbo -czf tashzone.tgz tashzone
scp -i "C:\Users\Muhammad Ahmed\.ssh\tashzone.key" tashzone.tgz ubuntu@141.148.193.78:~
```
Server (the `SCHILY.fflags` warning is harmless):
```bash
sudo mkdir -p /srv/tashzone && sudo chown ubuntu:ubuntu /srv/tashzone && tar -xzf ~/tashzone.tgz -C /srv/tashzone && mv /srv/tashzone/tashzone /srv/tashzone/repo && ls /srv/tashzone/repo
```
Secrets, generated on the server only (adjust domains to the IP or domain):
```bash
cat > /srv/tashzone/.env <<EOF
API_DOMAIN=api.141-148-193-78.sslip.io
MATCH_DOMAIN=match.141-148-193-78.sslip.io
LIVEKIT_DOMAIN=voice.141-148-193-78.sslip.io
POSTGRES_PASSWORD=$(openssl rand -hex 24)
PLAYER_TOKEN_SECRET=$(openssl rand -hex 32)
JOIN_TOKEN_SECRET=$(openssl rand -hex 32)
INTERNAL_API_TOKEN=$(openssl rand -hex 32)
LIVEKIT_URL=wss://voice.141-148-193-78.sslip.io
LIVEKIT_API_KEY=API$(openssl rand -hex 6)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 /srv/tashzone/.env && cut -d= -f1 /srv/tashzone/.env
```
- Without the `LIVEKIT_*` lines voice is off (`503 NOT_CONFIGURED`) — then also remove the `livekit` service from `backend/deploy/docker-compose.prod.yml`, or Compose will not start.
- Regenerating `PLAYER_TOKEN_SECRET` makes every app re-register; regenerating `LIVEKIT_API_SECRET` only drops calls in progress; **never change `POSTGRES_PASSWORD`** once the database exists.
- The API refuses to start if any secret is under 32 characters, a placeholder or reused (it names the key, never the value).

### B6. Start (Server)
```bash
cd /srv/tashzone/repo && docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml up -d --build
```
First build 5–10 minutes; then run C3.

---

## Part C: Releases and daily commands

```bash
alias tz='docker compose --env-file /srv/tashzone/.env -f /srv/tashzone/repo/backend/deploy/docker-compose.prod.yml'
```

### C1. Release
Preferred: `bash backend/deploy/deploy.sh` (J1). Manual steps:
1. PC: `pnpm turbo test` in `tashzone`; `python -m uv run pytest` in `backend/api`.
2. PC: create and upload the archive (B5).
3. Server: back up (D1), then swap, keeping the previous copy:
```bash
cd /srv/tashzone && rm -rf repo.previous && mv repo repo.previous && mkdir -p tmp && tar -xzf ~/tashzone.tgz -C tmp && mv tmp/tashzone repo && rmdir tmp && cd repo && tz up -d --build
```
4. Server: C3. Migrations run before the API starts.

Release in a quiet window (I5). **Planned (C-30):** build every release from an annotated git tag; the server's engine bundle hash must equal CI's; until then record the released commit in Part L.

### C2. Rollback
```bash
cd /srv/tashzone && mv repo repo.failed && mv repo.previous repo && cd repo && tz up -d --build
```
If the failed release ran a migration, restore the pre-release dump (D2).

### C3. Health checks
| Check | Expect |
|---|---|
| `tz ps` | `postgres`, `api` healthy; `room-maintenance`, `match-server`, `livekit`, `caddy` Up; `api-migrate` Exited (0) |
| `curl -s https://api.141-148-193-78.sslip.io/health` | `{"status":"ok"}` |
| `curl -s -o /dev/null -w "%{http_code}\n" https://match.141-148-193-78.sslip.io/` | `404` or `426` (`000` = Caddy or DNS) |
| `curl -s -o /dev/null -w "%{http_code}\n" https://api.141-148-193-78.sslip.io/api/v1/internal/rooms/ABCDEF` | `404` (internal routes blocked) |
| `curl -s https://voice.141-148-193-78.sslip.io/` | `OK` |
| `tz logs --tail=5 room-maintenance` | `room_maintenance` lines every 5 minutes |

### C4. Everyday commands
| Task | Command |
|---|---|
| Status / logs | `tz ps` · `tz logs --tail=100` · `tz logs -f <service>` |
| Room maintenance now | `tz exec room-maintenance python -m app.Workers.expire_rooms` |
| Restart / stop / start | `tz restart api` · `tz down` (volumes kept) · `tz up -d` |
| Live rooms | `tz exec -T match-server node -e "fetch('http://127.0.0.1:8787/health').then(r=>r.text()).then(console.log)"` |
| Disk, memory | `df -h /` · `free -h` · `docker system df` · `docker image prune -f` |
| Database shell | `tz exec postgres psql -U tashzone tashzone` |
| OS updates | `sudo apt update && sudo apt -y upgrade` (containers restart themselves) |

**Never run** `tz down -v` or `docker volume rm deploy_pgdata` — they delete the database.

---

## Part D: Backups and recovery

### D1. Nightly dump (set up once)
```bash
chmod +x /srv/tashzone/repo/backend/deploy/backup.sh && (crontab -l 2>/dev/null; echo "30 3 * * * /srv/tashzone/repo/backend/deploy/backup.sh") | crontab - && /srv/tashzone/repo/backend/deploy/backup.sh && ls -lh /srv/tashzone/backups
```
Copy to the PC:
```powershell
scp -i "C:\Users\Muhammad Ahmed\.ssh\tashzone.key" "ubuntu@141.148.193.78:/srv/tashzone/backups/*.dump" "D:\CardGame\backups\"
```
A local dump survives a bad migration only — not a lost instance. D3 is required before the first public release.

### D2. Restore a dump
```bash
tz stop api match-server && tz exec -T postgres pg_restore -U tashzone -d tashzone --clean --if-exists < /srv/tashzone/backups/tashzone-YYYY-MM-DD.dump && tz start api match-server
```

### D3. Production backups (Planned — required before RG-1)
**What needs backing up:** the `pgdata` volume (the only irreplaceable state) and archived WAL (`pgwal`) with its base backups. `.env` is backed up **separately** in a password manager, never beside the database. Code, Caddy certificates and chat/voice (never stored) need nothing; phone progress is not ours (L38).

**D3.1 WAL archiving.** Uncomment the postgres `command:` in `docker-compose.prod.yml`, then:
```bash
tz up -d postgres && tz exec postgres psql -U tashzone -c "SELECT archived_count, failed_count, last_failed_wal FROM pg_stat_archiver;"
```
`failed_count` must stay 0 — a failing archive keeps every WAL segment until the disk fills. Size check: `tz exec postgres psql -U tashzone -tAc "SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir();"`

**D3.2 Weekly base backup.**
```bash
tz exec -T postgres pg_basebackup -U tashzone -D - -Ft -z -Xnone > /srv/tashzone/backups/base-$(date +%F).tar.gz
```
Adopt pgBackRest (`sudo apt install pgbackrest`) when this needs more than a weekly cron.

**D3.3 Hourly WAL bundle** (C-31): one compressed archive of the past hour's WAL segments in `/srv/tashzone/backups`, so offsite restore loses at most one hour.

**D3.4 Offsite copy** to OCI Object Storage (20 GB, 50,000 requests/month, no egress cost in-region). Credential: a **Customer secret key** for a user scoped to this bucket only.
```bash
sudo apt -y install rclone
rclone config create oci s3 provider=Other env_auth=false access_key_id=<access-key> secret_access_key=<secret> region=ap-mumbai-1 endpoint=https://<namespace>.compat.objectstorage.ap-mumbai-1.oci.customer-oci.com force_path_style=true
rclone sync /srv/tashzone/backups oci:tashzone-backups/db --transfers 2
```
Add the sync and a nightly `rclone check` to cron. Budget: ≤ 15 GB and ≤ 10,000 requests/month (alarms at 12 GB and 8,000); shorten retention before either. Encrypt with `gpg --symmetric --cipher-algo AES256` if anyone but the owner handles dumps. Never upload `.env`.

**D3.5 Point-in-time restore.**
1. Rebuild (Part B); restore code and `.env`.
2. `tz up -d postgres && tz stop api match-server room-maintenance`.
3. Untar the base backup into the empty data directory; place archived WAL where `restore_command` finds it.
4. Add to the postgres `command:` temporarily: `-c restore_command='cp /var/lib/postgresql/archive/%f %p' -c recovery_target_time='<timestamp>' -c recovery_target_action=pause` (target after the base backup).
5. `tz exec postgres touch /var/lib/postgresql/data/recovery.signal && tz up -d postgres && tz logs -f postgres`
6. Check data → `SELECT pg_wal_replay_resume();` → remove the recovery lines → `tz up -d` → C3.
(`recovery.signal` is correct for PostgreSQL 17; re-check before a major upgrade.)

| Drill | Frequency | Pass |
|---|---|---|
| Restore latest dump into a scratch database | monthly | exit 0, player count matches |
| Full PITR on a throwaway instance, including from the bucket alone | before RG-1, then every 6 months and after a PostgreSQL major upgrade | cluster promotes; a row written after the target is absent |
| `rclone check` offsite vs local | nightly | no differences |

Record every drill in Part L.

---

## Part E: Domain (before RG-1)

1. Buy a domain; add **A** records `api`, `match`, `voice` → server IP, **DNS only** (required for `voice`).
2. Server: update `API_DOMAIN`, `MATCH_DOMAIN`, `LIVEKIT_DOMAIN`, `LIVEKIT_URL` in `.env`; `tz up -d`.
3. PC: update `EXPO_PUBLIC_API_URL` in `tashzone/app/eas.json`; rebuild (Part F). Keep sslip names working until testers update.

Alternatively reserve the public IP. The app needs only the API address; the API returns `MATCH_SERVER_URL`.

---

## Part F: App builds and update channel

The API address is compiled in from `EXPO_PUBLIC_API_URL` (public, `https://` only). No other build variable belongs in the repository.

| Build | Command (PC, in `tashzone/app`) |
|---|---|
| EAS test APK | `npx eas-cli login` then `npx eas-cli build --profile preview --platform android` |
| Local release APK | `powershell -ExecutionPolicy Bypass -File D:\CardGame\app\scripts\build-apk.ps1` (add `-Install` to push to a connected phone). Builds from the repo itself; the path must have no spaces (use `D:\CardGame`). First run installs JDK 17 and the Android SDK into `D:\android-toolchain`; then `assembleRelease`, signed from `app\credentials`. APK and log: `build\` at the repo root |
| Play build and upload | `npx eas-cli build --profile production --platform android` then `npx eas-cli submit --profile production --platform android` (Internal testing; first upload by hand) |

**Two-phone test:** Phone 1 → online room → Create → Share code; Phone 2 → Join → code or `tashzone://room/CODE`; Phone 1 → Start; play to the end; `tz logs --tail=50 match-server` shows the room and result with no errors.

**Update channel.** APKs live in `/srv/tashzone/releases`, served read-only at `https://<API_DOMAIN>/download/<file>`; `/api/v1/app-config` reads `APP_LATEST_VERSION`, `APP_LATEST_VERSION_CODE`, `APP_DOWNLOAD_URL`, `APP_DOWNLOAD_SHA256`, `APP_DOWNLOAD_SIZE_BYTES` from `.env` (api restarted after changes). The banner appears only for a higher `version_code` over `https`.
```bash
powershell -ExecutionPolicy Bypass -File app\scripts\build-apk.ps1
bash backend/deploy/deploy.sh --publish-apk
```
`--publish-apk` uploads, verifies the checksum, updates the five variables, restarts `api`, keeps the two newest APKs and checks the endpoint and download. The first publish needs a normal deploy first (Caddy route and mount). Check: `curl https://api.141-148-193-78.sslip.io/api/v1/app-config` (`{}` = nothing offered).

**Engine compatibility (Planned, C-23):** a phone whose rules behaviour differs from the server's is refused with `UPDATE_REQUIRED`; behaviour-changing engine releases ship to phones first.

---

## Part G: Voice and chat moderation

**Policy (owner decision 17 Sep 2026):** typed and voice chat are open to all ages, moderated rather than age-gated; nothing is stored; chat exists only inside private rooms.

**LiveKit:** image `livekit/livekit-server:v1`; config `backend/deploy/livekit.yaml` (no keys, mounted read-only); keys from `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`; 7880 unpublished (Caddy reaches it); 7881/tcp and 7882/udp published; `rtc.udp_port` must equal the Compose port; ~150–250 MB RAM. TURN/TLS on 5349 only if real devices fail.

**Add keys to an existing server:**
```bash
echo "LIVEKIT_API_KEY=API$(openssl rand -hex 6)" >> /srv/tashzone/.env && echo "LIVEKIT_API_SECRET=$(openssl rand -hex 32)" >> /srv/tashzone/.env && echo "LIVEKIT_DOMAIN=voice.141-148-193-78.sslip.io" >> /srv/tashzone/.env && echo "LIVEKIT_URL=wss://voice.141-148-193-78.sslip.io" >> /srv/tashzone/.env && chmod 600 /srv/tashzone/.env && cd /srv/tashzone/repo && tz up -d
```

**Health:** `tz ps livekit && tz logs --tail=20 livekit` (port and keys loaded); `curl -s https://voice.141-148-193-78.sslip.io/` → `OK`; `curl -s -o /dev/null -w "%{http_code}\n" "https://voice.141-148-193-78.sslip.io/rtc"` → `400` or `426`. Two phones in one room must hear each other; `tz logs --tail=50 api | grep voice_token_issued` shows both tokens.

| Control | Where |
|---|---|
| Word filter | app and match server; nothing stored |
| Mute | app only |
| Block | `player_blocks`; symmetric; checked on join and host start; ≤ 200 per player |
| Report | `reports`: two player ids, room, match, reason (`rude`/`cheating`/`other`), time; deleted after 180 days |
| Parent Settings | `parental_settings.free_text`, `.voice`; **on** by default (O-05, decided 22 Sep 2026; a reinstall returns them to on — say so in store forms and the policy) |
| Voice token | HS256, room-scoped, microphone-only, ~2 h (Planned: 10 min with refresh and removal on voice-off, C-29) |
| Room admission | Planned (C-28): host kick, lock, join approval; host transfer after 60 s |

**Store rules** (full detail in `08-store-compliance.md`): IARC "Users interact" = yes; Families declarations describe the Parent PIN and switches (and that they reset on reinstall); Data safety declares chat and voice as **collected, processed ephemerally**; the moderation policy must **not** claim reports are reviewed until review tooling exists; confirm DPDP/COPPA/GDPR position with counsel per market.

---

## Part H: Oracle Cloud specifics

**ARM64.** All images must publish `linux/arm64` (postgres:17, caddy:2, livekit v1, python:3.12-slim, node:22-slim all do). Build on the server, never under emulation; pin majors, never `latest`. Before adding an image: `docker manifest inspect <image>:<tag> | grep -A1 '"architecture"'`.

**Two firewalls.** The **security list / NSG** gates Docker-published ports (they bypass the host `INPUT` chain); host iptables gates host services. To restrict a published port, filter in `DOCKER-USER`. Never publish 5432 or 7880; never set `iptables: false` in Docker.

| Symptom | Cause |
|---|---|
| Connection refused | host reached; nothing listening (`tz ps`) |
| No route to host | host iptables rule missing or below the REJECT |
| Timeout | security list / NSG rule missing |
| TCP works, UDP not | UDP rule missing (separate entries) |

**Limits.** Compute 2 OCPU / 12 GB per tenancy (resize *or* a second instance, not both); block storage 200 GB; Object Storage 20 GB; egress 10 TB/month free, then about $0.025/GB from Mumbai (voice is the only real consumer: ~45,000–60,000 participant-hours per 10 TB).

**Idle reclamation applies:** under 20 % CPU, network and memory (p95) for 7 days → warning → stop a week later. Fix: **Pay As You Go with a budget alert** (still $0 inside free limits). Never fabricate load.

**Staying up.** `restart: unless-stopped` on long-running services; `api-migrate` runs once and must exit 0; healthcheck chain `postgres → api-migrate → api → match-server`; Caddy and LiveKit checked from outside (C3). Logs capped at 10 MB × 3 per service; logs never contain client IPs or message text.

| Watch | Command | Bad |
|---|---|---|
| Containers | `tz ps` | not Up/healthy, climbing restarts |
| Disk | `df -h /`, `docker system df` | > 80 % |
| Memory | `free -h` | swap in steady use |
| WAL | `SELECT failed_count FROM pg_stat_archiver;` | not 0 |
| Maintenance | `tz logs --tail=5 room-maintenance` | failures or silence > 10 min |
| Backups | `ls -lh /srv/tashzone/backups` | newest > 1 day |

Planned: OCI Monitoring alarms, APM synthetic checks, Sentry, integrity alarms.

### H5. Releasing during live play
On `SIGTERM` the match server refuses new connections, answers `/ready` 503, sends `SERVER_RESTARTING`, lets matches play up to `DRAIN_DEADLINE_MS` (10 min), flushes results and releases room claims. `stop_grace_period: 630s` must stay above the drain deadline.

**Procedure:**
1. Check live rooms (C4); `{"status":"ok","rooms":0}` is the green light.
2. Back up (D1).
3. Swap and rebuild (C1); `api-migrate` must exit 0.
4. Let it drain — never `docker kill`, never shorten the grace period.
5. `tz logs --tail=30 match-server`: `match_server_stopped` with `undeliveredResults` = 0.
6. C3 (and voice health for voice changes).
7. On failure: C2, and D2 if a migration ran.

API first when both change (it accepts the previous protocol version); a breaking protocol change needs the phone build first.

**Planned (C-14):** reconnections stay open during drain; after the deadline matches stop at the next hand boundary; hand-over to the new process under the same engine build, otherwise the match ends as interrupted; `stop_grace_period` = drain deadline + hand budget + 30 s. Until then release only with 0 live rooms.

**Second instance:** prohibited until fencing (C-20) and the hand journal exist and are verified (RG-4). Do not set `INSTANCE_URL` for a second replica before then.

---

## Part I: Troubleshooting

| Symptom | Fix |
|---|---|
| Public IPv4 switch greyed out | create the VCN with the wizard first (B1) |
| `ssh` fails in PowerShell ISE | use Windows Terminal |
| `UNPROTECTED PRIVATE KEY FILE` | run the `icacls` command (B3) |
| `Permission denied (publickey)` | use `tashzone.key`, user `ubuntu`, from the PC |
| `permission denied ... docker.sock` | log out and in |
| `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE` | Dockerfile uses `pnpm deploy --prod --legacy /out` |
| `{"detail":"Not Found"}` on health | path is `/health` |
| `Production requires real, distinct secrets` | regenerate the named value (`openssl rand -hex 32`) |
| `match-server` stays `Created` | `api` unhealthy: `tz logs api` |
| `/docs` 404 in production | intended |
| HTTPS or certificate errors | ports 80/443 (B1, B4) or DNS |
| match domain `000` | `tz ps`, `tz logs match-server` |
| App: online rooms unavailable | build lacks `EXPO_PUBLIC_API_URL`; rebuild |
| App: timeout but health works | phone network or stale API address in the build |
| Build killed or slow | check swap; resize (uses the rest of the free allowance) |
| Instance stopped after an email | idle reclamation: restart; Pay As You Go |
| Disk full | `docker image prune -f` |
| Compose: `add LIVEKIT_API_KEY to .env` | add the `LIVEKIT_*` lines (Part G) or remove `livekit` |
| Microphone button missing | `LIVEKIT_*` not set (`503 NOT_CONFIGURED`) |
| Voice connects, silent | 7882/udp in the security list; `rtc.udp_port` equals the Compose port |
| Voice fails on mobile data only | open 7881/tcp; TURN if still failing |
| `livekit`: `could not find any keys` | `LIVEKIT_*` lines missing |
| Voice certificate error | `voice` A record missing or proxied |
| Join `403 BLOCKED` | expected: mutual block |

---

## Part J: Scripts and signing

| Script | Where | Does |
|---|---|---|
| `backend/deploy/deploy.sh` | PC (Git Bash) | local gates → reachability → refuse if `.env` lacks `LIVEKIT_API_KEY` → refuse on live tables unless `--force` → upload → **backup before migrations** → swap (`repo.previous`) → migrate → schema version before/after → external checks. Flags `--skip-tests`, `--force`, `--publish-apk` |
| `backend/deploy/rollback.sh` | PC | restores code from `repo.previous`; does not restore the database (choose a dump, D2) |
| `backend/deploy/backup.sh` | server | D1 |
| `app/scripts/build-apk.ps1` | PC | local release APK (Part F): raises `versionCode` in `app/app.json`, builds and signs |

**Keystore.** `app/credentials/tashzone-release.keystore` and `keystore.properties` (RSA 4096, PKCS12, alias `tashzone`, 30 years), gitignored and outside the generated `android/` directory; wired by `app/plugins/with-release-signing.js` so `expo prebuild --clean` cannot drop it. **Losing it ends the app:** installs become un-updatable and every player would lose phone-only progress. Back up both files in a password manager or two encrypted copies (one offline), never in git, chat or `.env`; verify a copy is readable before any build leaves your phone. Enrol in **Play App Signing** at the first Play upload (this key becomes the upload key). Check a build: `"%JAVA_HOME%\bin\keytool" -printcert -jarfile app-release.apk` must show `CN=TashZone`, never `CN=Android Debug`.

---

## Part K: Release gates and evidence

A gate passes only when its evidence is recorded here. Definitions: `04_QUALITY_RELEASE_ROADMAP.md` §5.

| Gate | Unlocks | Status |
|---|---|---|
| RG-1 | any build leaving internal testing | not passed |
| RG-2 | first public release | not passed |
| RG-3 | same-Wi-Fi in a public build | not passed |
| RG-4 | second match-server instance | not passed |
| RG-5 | "Verify this hand", replays, disputes | not passed |
| RG-G | one game in a release | none passed |

| Date | Gate | Check | Tag / commit | Engine build | Result | Evidence location |
|---|---|---|---|---|---|---|
| 17 Sep 2026 | — | health, player creation, two-player Callbreak | 17 Sep 08:00 UTC build | — | pass | Part A |

Never record secrets, card data or player data here.

## Mobile over-the-air updates (EAS Update)

Configured on 2026-09-24: `expo-updates`, `runtimeVersion: { policy: "appVersion" }`, `updates.url` for the EAS project, and a channel per build profile in `app/eas.json` (development, preview, production). `eas update:configure` is not needed; it sets exactly these.

- **What can ship over the air:** JavaScript and assets only: text and translations, rules copy, festival dates, colours, layouts, bug fixes in app code.
- **What needs a store build:** anything that changes native code: adding or upgrading a native package, `app.json` plugin or permission changes, a new `expo` SDK. Also bump `expo.version` in `app/app.json`, because updates only reach builds with the same runtime version (`appVersion`).
- **Publish:** from `app/`, `eas update --channel production --message "<what changed>"`. Use `--channel preview` first and check on an internal build.
- **In the app:** updates download on launch. A "Restart / Later" banner offers to apply them; it never appears during a game, a lobby or the tutorial.
- **Roll back:** `eas update:rollback` (or republish the previous update) on the same channel.
- Builds made before this configuration cannot receive updates; ship one store build first.
