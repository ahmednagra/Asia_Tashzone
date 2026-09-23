#!/bin/sh
# Least-privilege role for the match server (03_PLATFORM.md §5.2). Grants are applied by Alembic 0001.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tz_match') THEN CREATE ROLE tz_match LOGIN PASSWORD '${TZ_MATCH_PASSWORD}'; END IF; END \$\$;"
