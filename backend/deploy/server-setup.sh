#!/usr/bin/env bash
#
# One-time preparation of a freshly (re)installed Oracle Cloud VM for TashZone (Ubuntu 24.04, ARM Ampere A1).
# Run it ON the server, as the `ubuntu` user, once. It is safe to run again: every step checks first, nothing is
# duplicated, and an existing /srv/tashzone/.env is never overwritten (regenerating secrets would log every app out
# and break the database password).
#
#   From your PC (Git Bash / PowerShell):
#     scp -i "C:\Users\Muhammad Ahmed\.ssh\tashzone.key" backend/deploy/server-setup.sh ubuntu@141.148.193.78:~
#     ssh -i "C:\Users\Muhammad Ahmed\.ssh\tashzone.key" ubuntu@141.148.193.78 "bash ~/server-setup.sh"
#   Then, from your PC, the first release:
#     bash backend/deploy/deploy.sh
#
# What it does (scripted form of the v1 runbook Part B4–B5 and D1):
#   1. system updates, unattended-upgrades, git, iptables-persistent
#   2. opens 80/tcp, 443/tcp, 443/udp, 7881/tcp, 7882/udp in the host firewall, ABOVE Oracle's final REJECT
#      (never ufw on an Oracle image: it removes the iSCSI boot-volume rules)
#   3. Docker Engine + Compose plugin; adds ubuntu to the docker group
#   4. 4 GB swap (image builds need it)
#   5. /srv/tashzone/{releases,backups}, owned by ubuntu
#   6. /srv/tashzone/.env with secrets generated here (chmod 600)
#   7. nightly database backup at 03:30 UTC (cron), and the `tz` shortcut for docker compose
#
# The Oracle security list / NSG must also allow the same five ports (console: Networking → VCN → Security).
set -euo pipefail

IP="${TASHZONE_IP:-141.148.193.78}"
DASHED="${IP//./-}"
API_DOMAIN="${API_DOMAIN:-api.$DASHED.sslip.io}"
MATCH_DOMAIN="${MATCH_DOMAIN:-match.$DASHED.sslip.io}"
LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN:-voice.$DASHED.sslip.io}"
ROOT=/srv/tashzone

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
[ "$(id -u)" -ne 0 ] || { echo "Run as the ubuntu user (it uses sudo where needed), not as root."; exit 1; }
[ "$(uname -m)" = "aarch64" ] || echo "Note: this is $(uname -m), not aarch64. The images support both; continuing."

say "1/7 System packages"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | sudo debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | sudo debconf-set-selections
sudo DEBIAN_FRONTEND=noninteractive apt-get -y install unattended-upgrades git curl openssl iptables-persistent netfilter-persistent

say "2/7 Host firewall (inserted above the final REJECT; found, never hard-coded)"
open_port() { # proto port [state-match]
  local proto="$1" port="$2"
  if sudo iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then
    echo "  $port/$proto already open"; return
  fi
  local r
  r=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/ {print $1; exit}')
  if [ -n "$r" ]; then sudo iptables -I INPUT "$r" -p "$proto" --dport "$port" -j ACCEPT
  else sudo iptables -A INPUT -p "$proto" --dport "$port" -j ACCEPT; fi
  echo "  opened $port/$proto"
}
open_port tcp 80
open_port tcp 443
open_port udp 443
open_port tcp 7881
open_port udp 7882
sudo cp /etc/iptables/rules.v4 /etc/iptables/rules.v4.bak 2>/dev/null || true
sudo netfilter-persistent save

say "3/7 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker
docker compose version 2>/dev/null || sudo docker compose version

say "4/7 Swap"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
swapon --show

say "5/7 Directories"
sudo mkdir -p "$ROOT/releases" "$ROOT/backups"
sudo chown -R "$USER:$USER" "$ROOT"
ls -la "$ROOT"

say "6/7 Secrets ($ROOT/.env)"
if [ -f "$ROOT/.env" ]; then
  echo "  $ROOT/.env exists: kept unchanged (keys present:)"
  cut -d= -f1 "$ROOT/.env" | tr '\n' ' '; echo
else
  umask 077
  cat > "$ROOT/.env" <<EOF
API_DOMAIN=$API_DOMAIN
MATCH_DOMAIN=$MATCH_DOMAIN
LIVEKIT_DOMAIN=$LIVEKIT_DOMAIN
POSTGRES_PASSWORD=$(openssl rand -hex 24)
TZ_MATCH_PASSWORD=$(openssl rand -hex 24)
PLAYER_TOKEN_SECRET=$(openssl rand -hex 32)
JOIN_TOKEN_SECRET=$(openssl rand -hex 32)
INTERNAL_API_TOKEN=$(openssl rand -hex 32)
SEED_ENCRYPTION_KEY=$(openssl rand -hex 32)
LIVEKIT_URL=wss://$LIVEKIT_DOMAIN
LIVEKIT_API_KEY=API$(openssl rand -hex 6)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
ONLINE_ENABLED=true
MIN_VERSION_CODE=1
EOF
  chmod 600 "$ROOT/.env"
  echo "  generated (values stay on this server):"; cut -d= -f1 "$ROOT/.env" | tr '\n' ' '; echo
fi

say "7/7 Nightly backup and the tz shortcut"
CRON="30 3 * * * bash $ROOT/repo/backend/deploy/backup.sh >> $ROOT/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'backend/deploy/backup.sh'; echo "$CRON" ) | crontab -
crontab -l | grep backup.sh
sudo tee /usr/local/bin/tz >/dev/null <<'EOF'
#!/bin/sh
# tz ps | tz logs -f api | tz up -d api | tz exec api python -m scripts.grant_moderator <player_id> --role admin
exec docker compose --env-file /srv/tashzone/.env -f /srv/tashzone/repo/backend/deploy/docker-compose.prod.yml "$@"
EOF
sudo chmod +x /usr/local/bin/tz

say "Done"
cat <<EOF
Server prepared for TashZone at $IP.
  API     https://$API_DOMAIN
  Match   wss://$MATCH_DOMAIN/match
  Voice   wss://$LIVEKIT_DOMAIN

Next:
  1. Oracle console: the security list / NSG must allow 80/tcp, 443/tcp, 443/udp, 7881/tcp, 7882/udp.
  2. Log out and back in once (docker group), or just run the deploy from your PC:
       bash backend/deploy/deploy.sh
  3. Appoint yourself admin moderator (player id from the app, Settings → About):
       tz exec api python -m scripts.grant_moderator <player_id> --role admin
EOF
if [ -f /var/run/reboot-required ]; then echo; echo "A reboot is required by the updates: sudo reboot (then deploy)."; fi
