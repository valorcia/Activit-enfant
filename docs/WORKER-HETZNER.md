# Worker du studio sur un serveur Hetzner

Le worker exécute les tâches longues du studio : génération des images, PDF, vidéos, pilote automatique. Sur votre serveur, il tourne en permanence dans un conteneur Docker et redémarre tout seul après une panne ou un redémarrage du serveur.

## Prérequis

- Un serveur Linux (Ubuntu 22.04 ou 24.04 conseillé) avec **au moins 2 vCPU et 4 Go de RAM**. Le rendu des vidéos et des gros PDF consomme de la mémoire. Un Hetzner CX22 ou CPX21 convient.
- Environ 10 Go d'espace disque libre.
- Un accès SSH (`ssh root@IP_DU_SERVEUR` ou votre utilisateur).

L'image du worker pèse environ 3,5 Go (Ubuntu 24.04, Node.js 22 et Chromium seul).

Le worker n'a besoin d'**aucun port ouvert** : il se connecte lui-même à la base Neon, au stockage R2, aux API (OpenAI, Anthropic, Runway) et au studio en ligne. Ne changez rien au pare-feu.

## 1. Installer Docker (une seule fois)

```bash
curl -fsSL https://get.docker.com | sh
docker --version
```

## 2. Récupérer le code

Le dépôt est privé : le serveur a besoin d'une **clé de déploiement** en lecture seule.

```bash
ssh-keygen -t ed25519 -C "worker-hetzner" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Copiez la ligne affichée. Sur GitHub, ouvrez le dépôt `valorcia/Activit-enfant` → **Settings → Deploy keys → Add deploy key**, collez la clé, laissez « Allow write access » **décoché**, puis enregistrez.

```bash
cat >> ~/.ssh/config <<'CONF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
CONF
cd ~
git clone git@github.com:valorcia/Activit-enfant.git
cd Activit-enfant
git checkout claude/inventor-studio
```

## 3. Configurer

```bash
cp apps/studio/.env.production.example apps/studio/.env.production
nano apps/studio/.env.production
```

Renseignez les mêmes valeurs que le projet Vercel du studio :
- `DATABASE_URL` et `DATABASE_URL_UNPOOLED` (Neon) ;
- `DB_SCHEMA=studio` ;
- `APP_URL` : l'adresse du studio en ligne ;
- `INTERNAL_TOKEN` : identique à celui de Vercel ;
- `STORAGE_DRIVER=s3` et les variables `S3_*` du bucket R2 du studio ;
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` et `RUNWAY_API_KEY` si vous les utilisez.

Supprimez ou laissez vide la ligne `CHROMIUM_PATH` : le conteneur fournit Chromium.

Enregistrez avec Ctrl+O puis Entrée, et quittez avec Ctrl+X.

## 4. Lancer

```bash
docker compose -f apps/studio/deploy/hetzner/docker-compose.yml up -d --build
```

La première construction prend 5 à 10 minutes. Ensuite :

```bash
docker logs -f studio-worker      # suivre ce que fait le worker (Ctrl+C pour quitter le suivi)
docker ps                          # vérifier qu'il tourne
```

Dans le studio, lancez un e-book : la tâche doit passer de « en attente » à « en cours » en quelques secondes.

## 5. Mettre à jour (après chaque évolution du code)

```bash
~/Activit-enfant/apps/studio/deploy/hetzner/update.sh
```

Ce script récupère la dernière version du code, reconstruit l'image et redémarre le worker. Les tâches en cours reprennent après le redémarrage.

Sur un petit disque (20 Go), s'il reste moins de 10 Go libres, le script arrête d'abord le worker et supprime l'ancienne image : la construction a besoin d'environ 6 Go de plus. Le worker est alors indisponible environ 6 minutes, puis les tâches reprennent. Un serveur CX22 (40 Go, 4 Go de mémoire) évite cet arrêt.

## Commandes utiles

| Action | Commande |
|---|---|
| Voir le journal | `docker logs -f studio-worker` |
| Redémarrer | `docker restart studio-worker` |
| Arrêter | `docker compose -f apps/studio/deploy/hetzner/docker-compose.yml down` |
| Mémoire et CPU utilisés | `docker stats studio-worker` |

## Bon à savoir

- Ne lancez pas aussi le worker sur votre PC en même temps : ce n'est pas dangereux (les tâches sont réparties), mais inutile.
- Le fichier `.env.production` contient des secrets : il reste uniquement sur le serveur et n'est jamais envoyé sur GitHub (il est ignoré par git).
