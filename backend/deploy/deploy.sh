#!/usr/bin/env bash
#
# Deploys the current working tree to the Oracle Cloud server: uploads the code, backs the database up,
# swaps the release in keeping the old one for rollback, runs the migrations and verifies the result.
#
# Run it from your PC (Git Bash on Windows, or any shell with ssh/scp/tar), not on the server:
#
#   bash backend/deploy/deploy.sh
#   bash backend/deploy/deploy.sh --skip-tests      # when the gates already passed this minute
#   bash backend/deploy/deploy.sh --force           # deploy even though tables are live
#   bash backend/deploy/deploy.sh --publish-apk     # publish the built APK as the update the app offers
#
# --publish-apk does not deploy code. It uploads app/android/app/build/outputs/apk/release/app-release.apk
# to /srv/tashzone/releases, points the APP_* release variables in /srv/tashzone/.env at it and restarts the
# api container so they are read. Build first (app\scripts\build-apk.ps1), then publish.
#
# First time on a freshly reinstalled server: run backend/deploy/server-setup.sh ON the server once (Docker,
# firewall, swap, /srv/tashzone, generated secrets, nightly backup), then run this script from your PC.
#
# It is the scripted form of `Docs/specs/05_DEPLOYMENT_RUNBOOK.md` (Part C1), and it refuses rather than guesses: a failed
# gate, a missing secret, a failed migration or a failed health check all stop it with a message that says
# what to do. Nothing here is irreversible until the migrations run, and the backup taken immediately before
# them is what makes even that recoverable (`--rollback`, or Part D2).
#
set -euo pipefail

HOST="${TASHZONE_HOST:-141.148.193.78}"
SSH_USER="${TASHZONE_SSH_USER:-ubuntu}"
SSH_KEY="${TASHZONE_SSH_KEY:-$HOME/.ssh/tashzone.key}"
API_URL="${TASHZONE_API_URL:-https://api.141-148-193-78.sslip.io}"
MATCH_URL="${TASHZONE_MATCH_URL:-https://match.141-148-193-78.sslip.io}"

SKIP_TESTS=0
FORCE=0
PUBLISH_APK=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --force) FORCE=1 ;;
    --publish-apk) PUBLISH_APK=1 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mFAILED: %s\033[0m\n' "$1" >&2; exit 1; }
ssh_run() { ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 "$SSH_USER@$HOST" "$@"; }

[ -f "$SSH_KEY" ] || die "No SSH key at $SSH_KEY. Set TASHZONE_SSH_KEY to its path."

# ---------------------------------------------------------------- publish an APK
# Separate from a code deploy, because they are separate events: the server can be redeployed a dozen times
# without a new build to offer, and a new build can be offered without touching the backend.
if [ "$PUBLISH_APK" -eq 1 ]; then
  APK="${TASHZONE_APK:-$ROOT/app/android/app/build/outputs/apk/release/app-release.apk}"
  GRADLE="$ROOT/app/android/app/build.gradle"

  [ -f "$APK" ] || die "No APK at $APK
Build one first: powershell -ExecutionPolicy Bypass -File app\\scripts\\build-apk.ps1"
  [ -f "$GRADLE" ] || die "No $GRADLE, so the version this APK carries cannot be read."

  # Read from build.gradle rather than from a flag: build-apk.ps1 raises the number immediately before
  # compiling, so it is what the binary actually contains. A number typed by hand can be wrong, and an APK
  # advertised under the wrong versionCode either never offers itself or offers itself forever.
  CODE="$(sed -n 's/.*versionCode[[:space:]=]\{1,\}\([0-9]\{1,\}\).*/\1/p' "$GRADLE" | head -1)"
  NAME="$(sed -n 's/.*versionName[[:space:]=]\{1,\}"\([^"]*\)".*/\1/p' "$GRADLE" | head -1)"
  [ -n "$CODE" ] && [ -n "$NAME" ] || die "Could not read versionCode/versionName from $GRADLE"

  SIZE="$(wc -c < "$APK" | tr -d ' ')"
  SHA="$(sha256sum "$APK" | cut -d' ' -f1)"
  FILE="tashzone-$CODE.apk"
  URL="$API_URL/download/$FILE"

  say "Publishing $NAME ($CODE)"
  printf '  file   %s\n  size   %s MB\n  sha256 %s\n  url    %s\n' \
    "$FILE" "$((SIZE / 1048576))" "$SHA" "$URL"

  ssh_run true || die "Cannot reach $SSH_USER@$HOST over SSH."
  ssh_run "mkdir -p /srv/tashzone/releases" < /dev/null || die "Could not create /srv/tashzone/releases"

  say "Uploading the APK"
  scp -i "$SSH_KEY" -o BatchMode=yes "$APK" "$SSH_USER@$HOST:/srv/tashzone/releases/$FILE.part" || die "Upload failed"

  # Moved into place only once the whole file has arrived, and checked on the server rather than trusting scp:
  # a half-uploaded APK under the real name is an update that every phone would download and fail to install.
  REMOTE_SHA="$(ssh_run "sha256sum /srv/tashzone/releases/$FILE.part | cut -d' ' -f1")" < /dev/null || die "Could not checksum the upload"
  [ "$REMOTE_SHA" = "$SHA" ] || die "The APK on the server does not match the one here.
  here:   $SHA
  server: $REMOTE_SHA"
  ssh_run "mv /srv/tashzone/releases/$FILE.part /srv/tashzone/releases/$FILE" < /dev/null || die "Could not put the APK in place"

  say "Pointing the release variables at it"
  # Rewritten with grep and printf rather than a script on the server: the only tools this needs are the ones
  # ssh already guarantees. The old file is kept as .env.previous, because a .env that loses a line stops
  # every container from starting.
  ssh_run "set -e
    cd /srv/tashzone
    cp .env .env.previous
    grep -v '^APP_LATEST_VERSION=' .env.previous \
      | grep -v '^APP_LATEST_VERSION_CODE=' \
      | grep -v '^APP_DOWNLOAD_URL=' \
      | grep -v '^APP_DOWNLOAD_SHA256=' \
      | grep -v '^APP_DOWNLOAD_SIZE_BYTES=' > .env.next
    printf 'APP_LATEST_VERSION=%s\nAPP_LATEST_VERSION_CODE=%s\nAPP_DOWNLOAD_URL=%s\nAPP_DOWNLOAD_SHA256=%s\nAPP_DOWNLOAD_SIZE_BYTES=%s\n' \
      '$NAME' '$CODE' '$URL' '$SHA' '$SIZE' >> .env.next
    mv .env.next .env
    grep '^APP_' .env" < /dev/null || die "Could not update /srv/tashzone/.env"

  # get_settings() is lru_cached, so the api process reads these once at start and never again.
  say "Restarting the API so it reads them"
  ssh_run "cd /srv/tashzone/repo && docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml up -d --force-recreate api" < /dev/null \
    || die "Could not restart the api container"

  # Two releases is enough to roll back to; more is just disk. Each APK is over 100 MB.
  ssh_run "ls -1t /srv/tashzone/releases/tashzone-*.apk 2>/dev/null | tail -n +3 | xargs -r rm -f; ls -lh /srv/tashzone/releases" < /dev/null || true

  say "Verifying"
  PUBLISHED="$(curl -fsS -m 30 "$API_URL/api/v1/app-config" || echo '')"
  case "$PUBLISHED" in
    *"\"version_code\":$CODE"*) echo "  app-config           offers $NAME ($CODE)" ;;
    *) die "The API is not offering this build yet. It answered: ${PUBLISHED:-nothing}" ;;
  esac

  DL_CODE="$(curl -s -o /dev/null -w '%{http_code}' -m 60 -r 0-1023 "$URL" || echo 000)"
  case "$DL_CODE" in
    200|206) echo "  download             ok ($DL_CODE)" ;;
    *) die "The APK is not downloadable at $URL (HTTP $DL_CODE). Caddy may need the releases mount: redeploy." ;;
  esac

  say "Published. Phones on an older build will be offered $NAME on their next launch."
  exit 0
fi

# ---------------------------------------------------------------- 1. local gates
# A release that fails its own tests is not a release. Skipping is allowed, never silent.
if [ "$SKIP_TESTS" -eq 1 ]; then
  say "Skipping local gates (--skip-tests)"
else
  say "Running local gates"
  pnpm build  || die "pnpm build failed"
  pnpm check  || die "pnpm check (lint, typecheck, tests) failed"
  ( cd backend/api && PLAYER_TOKEN_SECRET=pppppppppppppppppppppppppppppppppppppppp JOIN_TOKEN_SECRET=jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj \
      INTERNAL_API_TOKEN=iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii uv run pytest -q ) || die "API tests failed"
fi

# ---------------------------------------------------------------- 2. server preflight
say "Checking the server"
ssh_run true || die "Cannot reach $SSH_USER@$HOST over SSH."

# Compose refuses to start at all when the LiveKit keys are absent, so find out now rather than half way
# through a release with the old containers already stopped.
ssh_run "test -f /srv/tashzone/.env" < /dev/null || die "/srv/tashzone/.env does not exist. Run backend/deploy/server-setup.sh on the server first."
for key in LIVEKIT_API_KEY TZ_MATCH_PASSWORD SEED_ENCRYPTION_KEY POSTGRES_PASSWORD; do
  ssh_run "grep -q '^$key=' /srv/tashzone/.env" < /dev/null \
    || die "/srv/tashzone/.env has no $key, and the production Compose file will not start without it (see .env.example)."
done

# A restart drains live tables for up to DRAIN_DEADLINE_MS. Deploying onto a busy server is allowed; doing it
# by accident is not.
ROOMS="$(ssh_run "docker compose --env-file /srv/tashzone/.env -f /srv/tashzone/repo/backend/deploy/docker-compose.prod.yml exec -T match-server node -e \"fetch('http://127.0.0.1:8787/health').then(r=>r.text()).then(t=>console.log(t))\" 2>/dev/null" || echo '')"
if echo "$ROOMS" | grep -qE '"rooms":[1-9]'; then
  if [ "$FORCE" -eq 0 ]; then
    die "Tables are live right now: $ROOMS
Matches in progress finish during the drain, but new rooms wait. Re-run with --force to deploy anyway."
  fi
  say "Deploying with live tables (--force): $ROOMS"
fi

# ---------------------------------------------------------------- 3. upload
say "Packing the working tree"
ARCHIVE="$(mktemp -t tashzone-XXXXXX).tgz"
tar --exclude=node_modules --exclude=.expo --exclude=.venv --exclude=dist --exclude=.turbo \
    --exclude=android --exclude=ios --exclude=.git --exclude=.pytest_cache --exclude=__pycache__ --exclude=Research \
    -czf "$ARCHIVE" -C "$(dirname "$ROOT")" "$(basename "$ROOT")" \
  || die "Could not create the archive"
printf 'archive: %s\n' "$(du -h "$ARCHIVE" | cut -f1)"

say "Uploading"
scp -i "$SSH_KEY" -o BatchMode=yes "$ARCHIVE" "$SSH_USER@$HOST:~/tashzone.tgz" || die "Upload failed"

# ---------------------------------------------------------------- 4. release on the server
say "Backing up, swapping the release and migrating"

# The remote steps are uploaded and run as a FILE, never piped to `bash -s` on stdin.
#
# Learned the hard way on 18 Sep 2026: with `ssh 'bash -s' <<EOF`, the script arrives on the remote shell's
# stdin, and the first command that reads stdin -- `docker compose exec` inside backup.sh -- swallows the rest
# of it. Bash then reaches EOF and exits **0**, so the release reported success having done nothing after the
# first line: no swap, no migrations, and `|| die` never fired because the exit status was clean. A deploy that
# fails is recoverable; one that lies about succeeding is not.
RELEASE_TAG="${TASHZONE_RELEASE_TAG:-$(date -u +%Y%m%d-%H%M)}"
RELEASE_COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
REMOTE_SCRIPT="$(mktemp -t tz-release-XXXXXX).sh"
trap 'rm -f "$ARCHIVE" "$REMOTE_SCRIPT"' EXIT
cat > "$REMOTE_SCRIPT" <<'REMOTE'
set -euo pipefail
COMPOSE="docker compose --env-file /srv/tashzone/.env -f /srv/tashzone/repo/backend/deploy/docker-compose.prod.yml"

export RELEASE_TAG RELEASE_COMMIT  # shell values win over --env-file for Compose interpolation
if [ -d /srv/tashzone/repo ] && $COMPOSE ps --status running postgres 2>/dev/null | grep -q postgres; then
  echo "--- database backup (before any migration) ---"
  bash /srv/tashzone/repo/backend/deploy/backup.sh
  ls -lh /srv/tashzone/backups | tail -3
  echo "--- schema version before ---"
  $COMPOSE exec -T postgres psql -U tashzone tashzone -tAc 'select version_num from alembic_version' || true
else
  echo "--- first release on this server: nothing to back up ---"
fi
echo "--- swapping the release ---"
cd /srv/tashzone
rm -rf repo.previous
if [ -d repo ]; then mv repo repo.previous; fi
mkdir -p tmp && rm -rf tmp/*
tar -xzf ~/tashzone.tgz -C tmp
mv tmp/* repo
rmdir tmp

# Created before compose runs, and by this user. A bind mount whose source is missing is created by Docker
# as root, and the next --publish-apk then cannot scp into it.
mkdir -p /srv/tashzone/releases

# A Caddyfile that does not parse takes the whole site down: Caddy refuses to start, and with it go the API
# and the match server behind it. Checked here, against the real environment values, while the old containers
# are still serving. `set -e` stops the release before anything is restarted.
echo "--- validating the Caddy config ---"
docker run --rm   --env-file /srv/tashzone/.env   -v /srv/tashzone/repo/backend/deploy/Caddyfile:/etc/caddy/Caddyfile:ro   caddy:2 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "--- building and starting (api-migrate runs the migrations first) ---"
cd /srv/tashzone/repo
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml up -d --build

# Caddy and LiveKit read their configuration from files bind-mounted out of the release directory, and the
# swap above replaced that directory. Compose does not notice: their service definitions are unchanged, so
# the old containers keep serving the old files through the inodes the swap moved into repo.previous. They
# are recreated unconditionally rather than when the file looks changed, because "changed" can only be
# judged against the previous release, not against what the running container actually holds -- and that is
# exactly how a fixed Caddyfile shipped on 19 Sep and did not take effect.
echo "--- recreating the containers whose config comes from the release ---"
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml up -d --force-recreate caddy livekit

echo "--- migration result ---"
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml logs --tail=20 api-migrate

echo "--- schema version after ---"
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml exec -T postgres psql -U tashzone tashzone -tAc 'select version_num from alembic_version'

echo "--- containers ---"
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml ps --format '{{.Service}}	{{.Status}}'
echo "--- RELEASE_OK ---"
REMOTE

{ printf "RELEASE_TAG='%s'\nRELEASE_COMMIT='%s'\n" "$RELEASE_TAG" "$RELEASE_COMMIT"; cat "$REMOTE_SCRIPT"; } > "$REMOTE_SCRIPT.full" && mv "$REMOTE_SCRIPT.full" "$REMOTE_SCRIPT"
scp -i "$SSH_KEY" -o BatchMode=yes "$REMOTE_SCRIPT" "$SSH_USER@$HOST:/tmp/tz-release.sh" >/dev/null   || die "Could not upload the release script"

# `< /dev/null` as well, so nothing on the remote side can reach for this shell's stdin either.
RELEASE_OUT="$(ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_USER@$HOST" "bash /tmp/tz-release.sh; rm -f /tmp/tz-release.sh" < /dev/null 2>&1)" || {
  printf '%s
' "$RELEASE_OUT"
  die "The release failed on the server. The previous code is at /srv/tashzone/repo.previous — see Part C2 to roll back."
}
printf '%s
' "$RELEASE_OUT"

# Exit status alone is not proof: the sentinel is printed only if every step above it ran.
case "$RELEASE_OUT" in
  *RELEASE_OK*) : ;;
  *) die "The release script stopped early — the RELEASE_OK marker is missing, so the migrations may not have run.
Check /srv/tashzone/repo.previous and the output above before retrying." ;;
esac

# ---------------------------------------------------------------- 5. verify from outside
# Checked from here rather than on the server, because that is where the players are (Part C3).
say "Verifying"
FAILED=0

HEALTH="$(curl -fsS -m 25 "$API_URL/health" || echo '')"
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "  API /health          ok ($HEALTH)"
else
  echo "  API /health          UNEXPECTED: ${HEALTH:-no answer}"; FAILED=1
fi

MATCH_CODE="$(curl -s -o /dev/null -w '%{http_code}' -m 25 "$MATCH_URL/" || echo 000)"
case "$MATCH_CODE" in
  404|426) echo "  match server         ok ($MATCH_CODE)" ;;
  *) echo "  match server         UNEXPECTED: $MATCH_CODE (000 means Caddy or DNS)"; FAILED=1 ;;
esac

CONFIG="$(curl -fsS -m 25 "$API_URL/api/v1/app-config" || echo '')"
if echo "$CONFIG" | grep -q '"engine_build_hash":"[0-9a-f]\{64\}"'; then
  echo "  app-config           ok (engine manifest served)"
else
  echo "  app-config           UNEXPECTED: ${CONFIG:0:200}"; FAILED=1
fi
INTERNAL_CODE="$(curl -s -o /dev/null -w '%{http_code}' -m 25 "$API_URL/api/v1/internal/rooms/ABCDEF" || echo 000)"
if [ "$INTERNAL_CODE" = "404" ]; then
  echo "  internal routes      blocked at Caddy (404)"
else
  # Not a warning. Anything but 404 means the service-to-service routes are answering the open internet,
  # which is the one property this check exists to hold.
  echo "  internal routes      REACHABLE FROM THE INTERNET ($INTERNAL_CODE, expected 404) — see Part C3"; FAILED=1
fi

if [ "$FAILED" -eq 0 ]; then
  say "Deployed. Previous release kept at /srv/tashzone/repo.previous for rollback."
else
  die "Deployed, but a health check did not pass. Roll back with Part C2 if players are affected."
fi
