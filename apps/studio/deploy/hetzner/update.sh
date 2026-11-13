#!/usr/bin/env bash
# Met à jour le worker : récupère la dernière version du code, reconstruit l'image et redémarre.
# Usage (sur le serveur) : ~/Activit-enfant/apps/studio/deploy/hetzner/update.sh
set -euo pipefail
cd "$(dirname "$0")/../../../.."
COMPOSE="docker compose -f apps/studio/deploy/hetzner/docker-compose.yml"
git pull --ff-only

# Petit disque (20 Go) : pas la place pour l'ancienne et la nouvelle image en même temps.
# Sous 10 Go libres, on arrête d'abord le worker et on supprime l'ancienne image (environ 6 min d'arrêt).
FREE_GB=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
if [ "${FREE_GB:-0}" -lt 10 ]; then
  echo "Espace libre : ${FREE_GB} Go — arrêt du worker pendant la reconstruction pour libérer la place."
  $COMPOSE down
  docker image rm studio-worker:latest 2>/dev/null || true
  docker builder prune -af >/dev/null || true
fi

$COMPOSE up -d --build
docker image prune -f >/dev/null
# Cache de construction : chaque mise à jour en laisse plusieurs Go sur un petit disque
docker builder prune -af --filter until=24h >/dev/null || true
$COMPOSE ps
df -h / | tail -1 | awk '{print "Disque : " $3 " utilisés, " $4 " libres (" $5 ")"}'
echo "Journal : docker logs -f studio-worker"
