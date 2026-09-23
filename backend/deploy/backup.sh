#!/usr/bin/env bash
# Nightly database backup, kept for 14 days. Cron: 30 3 * * * /srv/tashzone/repo/backend/deploy/backup.sh
# Copy the backups directory offsite too (for example with rclone to a free R2 or B2 bucket).
set -euo pipefail
DIR=/srv/tashzone/backups
mkdir -p "$DIR"
cd /srv/tashzone/repo
docker compose --env-file /srv/tashzone/.env -f backend/deploy/docker-compose.prod.yml exec -T postgres \
  pg_dump -U tashzone --format=custom tashzone > "$DIR/tashzone-$(date +%F).dump"
find "$DIR" -name 'tashzone-*.dump' -mtime +14 -delete
