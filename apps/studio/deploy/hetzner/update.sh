#!/usr/bin/env bash
# Met à jour le worker : récupère la dernière version du code, reconstruit l'image et redémarre.
# Usage (sur le serveur) : ~/Activit-enfant/apps/studio/deploy/hetzner/update.sh
set -euo pipefail
cd "$(dirname "$0")/../../../.."
git pull --ff-only
docker compose -f apps/studio/deploy/hetzner/docker-compose.yml up -d --build
docker image prune -f >/dev/null
docker compose -f apps/studio/deploy/hetzner/docker-compose.yml ps
echo "Journal : docker logs -f studio-worker"
