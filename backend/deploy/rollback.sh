#!/usr/bin/env bash
#
# Puts the previous release back (Docs/05_DEPLOYMENT_RUNBOOK.md Part C2). Run from your PC:
#
#   bash backend/deploy/rollback.sh
#
# This restores the CODE only. If the release you are undoing ran a migration, the database is still on the
# new schema and the old code may not understand it — the script says so and prints the backups to restore
# from (Part D2). It does not restore the database on its own, because choosing which dump to go back to is
# a decision, not a default.
#
set -euo pipefail

HOST="${TASHZONE_HOST:-141.148.193.78}"
SSH_USER="${TASHZONE_SSH_USER:-ubuntu}"
SSH_KEY="${TASHZONE_SSH_KEY:-$HOME/.ssh/tashzone.key}"
API_URL="${TASHZONE_API_URL:-https://api.141-148-193-78.sslip.io}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mFAILED: %s\033[0m\n' "$1" >&2; exit 1; }

[ -f "$SSH_KEY" ] || die "No SSH key at $SSH_KEY"

say "Rolling back to the previous release"
# The script travels on the remote shell's stdin, so every docker command in it gets `< /dev/null`: an
# unredirected `docker compose exec` swallows the rest of the script and bash exits 0 having done nothing
# (the deploy.sh incident of 18 Sep 2026). ROLLBACK_OK is printed only if every step ran.
ROLLBACK_OUT="$(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 "$SSH_USER@$HOST" 'bash -s' 2>&1 <<'REMOTE'
set -euo pipefail
cd /srv/tashzone
[ -d repo.previous ] || { echo "There is no /srv/tashzone/repo.previous to roll back to."; exit 1; }

BEFORE="$(docker compose --env-file /srv/tashzone/.env -f /srv/tashzone/repo/backend/deploy/docker-compose.prod.yml exec -T postgres psql -U tashzone tashzone -tAc 'select version_num from alembic_version' < /dev/null 2>/dev/null || echo unknown)"

rm -rf repo.failed
mv repo repo.failed
mv repo.previous repo
cd repo
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml up -d --build < /dev/null

AFTER="$(docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml exec -T postgres psql -U tashzone tashzone -tAc 'select version_num from alembic_version' < /dev/null 2>/dev/null || echo unknown)"
echo "--- schema is still $AFTER (it was $BEFORE before the rollback) ---"
echo "--- backups available ---"
ls -lh /srv/tashzone/backups | tail -5
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml ps --format '{{.Service}}\t{{.Status}}' < /dev/null
echo "--- ROLLBACK_OK ---"
REMOTE
)" || { printf '%s\n' "$ROLLBACK_OUT"; die "Rollback failed on the server"; }
printf '%s\n' "$ROLLBACK_OUT"
case "$ROLLBACK_OUT" in
  *ROLLBACK_OK*) : ;;
  *) die "The rollback script stopped early (no ROLLBACK_OK marker). Check /srv/tashzone/repo and repo.failed by hand." ;;
esac

say "Checking the API"
curl -fsS -m 25 "$API_URL/health" || echo "  /health did not answer"
echo
say "Code rolled back. The failed release is kept at /srv/tashzone/repo.failed.
If it had run a migration, restore the pre-release dump as well — Docs/05_DEPLOYMENT_RUNBOOK.md Part D2."
