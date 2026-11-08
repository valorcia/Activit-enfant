# @malle/video — vidéos publicitaires

Deux étages, pilotés depuis le PC (même machine que le worker du studio) :

1. **Montage Remotion (gratuit)** : une publicité de 6 à 20 s est montée à partir des illustrations et de la fiche produit. Elle enchaîne quatre scènes : accroche, contenu du kit, bénéfices, puis offre avec le prix, l'appel à l'action et le logo. Trois formats sont disponibles : `story` 1080×1920 (Reels, TikTok, Stories), `square` 1080×1080 et `landscape` 1920×1080. Aucun texte n'est placé dans les 10 % du haut ni les 15 % du bas, zones masquées par Reels et TikTok.
2. **Animation IA d'une illustration (payant)** : un clip de 5 ou 10 s généré par Runway (Gen-4 Turbo, image → vidéo) remplace l'image fixe de la scène d'accroche. Une interface commune `VideoProvider` permet d'ajouter Veo ou Sora sans toucher au reste. Un mode **copier-coller** prépare le prompt à coller dans l'interface de Runway, Sora ou Veo ; vous fournissez ensuite le MP4.

## Installation

```bash
pnpm install          # à la racine du monorepo
```

Le rendu utilise le Chromium déjà présent (`CHROMIUM_PATH`, ou Chromium installé par Playwright), sinon Remotion télécharge le sien au premier rendu. ffmpeg est fourni par Remotion.

Variables d'environnement (fichier `.env` ou shell) :

| Variable | Rôle |
|---|---|
| `SHOP_API_KEY` | Clé API de la boutique (Admin → API & automatisation, scopes `products:read` + `products:write`) |
| `RUNWAY_API_KEY` | Clé Runway (dev.runwayml.com), uniquement pour l'animation IA |
| `CHROMIUM_PATH` | Facultatif : chemin d'un Chromium local |

L'admin de la boutique contient aussi un emplacement « Runway » (Paramètres → Intégrations) pour un usage futur côté serveur ; le paquet vidéo, qui tourne sur votre PC, lit `RUNWAY_API_KEY`.

## Utilisation

```bash
# 1. Monter une publicité 9:16 à partir de la fiche produit
pnpm --filter @malle/video ad render --product tresor-capitaine-coquelicot --shop https://activite-enfant-shop.vercel.app --format story --out coquelicot-story.mp4

# Avec une musique (fichier libre de droits) et une accroche personnalisée
pnpm --filter @malle/video ad render --product tresor-capitaine-coquelicot --shop https://… --music musique.mp3 --hook "Une chasse au trésor prête en 20 minutes !"

# 2. Animer l'illustration de couverture avec Runway (≈ 0,25 $ pour 5 s)
pnpm --filter @malle/video ad prompt --description "pirate captain with a parrot and an open treasure chest on a beach" --universe pirates
pnpm --filter @malle/video ad animate --image couverture.png --universe pirates --description "…" --provider runway --format story --duration 5 --out clip.mp4

#    … ou en mode copier-coller (aucune clé) : affiche le prompt et les réglages à utiliser dans Runway / Sora / Veo
pnpm --filter @malle/video ad animate --image couverture.png --description "…" --provider manual

# 3. Remonter la publicité avec le clip animé en accroche
pnpm --filter @malle/video ad render --product tresor-capitaine-coquelicot --shop https://… --clip clip.mp4 --out coquelicot-anime.mp4

# 4. Publier la vidéo sur la boutique (devient un média du produit, proposé dans Marketing social → Posts)
pnpm --filter @malle/video ad publish --product tresor-capitaine-coquelicot --file coquelicot-story.mp4 --shop https://… --format story --title "Pub 9:16"
```

L'aperçu interactif des compositions s'ouvre avec `pnpm --filter @malle/video studio` (Remotion Studio).

### Envoi vers la boutique

`ad publish` utilise `POST /api/v1/products/:id/videos`. Avec le stockage S3 (cas Vercel), la vidéo est déposée directement sur le bucket via une URL signée, ce qui contourne la limite de 4,5 Mo des requêtes Vercel. Avec le stockage local, elle est envoyée en multipart (200 Mo maximum). Dans l'admin boutique, Marketing social → Posts propose ensuite la vidéo pour les Reels Instagram, les vidéos de Page Facebook et TikTok. La publication automatique passe par les API officielles une fois les comptes connectés ; sinon, le bouton « Télécharger la vidéo » permet de la publier à la main.

## Coûts indicatifs

| Étage | Coût |
|---|---|
| Montage Remotion | 0 € (calcul sur votre PC, quelques dizaines de secondes par vidéo) |
| Runway Gen-4 Turbo | ≈ 5 crédits/s, 1 crédit ≈ 0,01 $, soit ≈ 0,25 $ par clip de 5 s et 0,50 $ pour 10 s |

Ces tarifs sont à vérifier sur la page de prix de Runway ; ils sont paramétrables (`creditsPerSecond`, `usdPerCredit`).

## Licence Remotion

Remotion est gratuit pour les particuliers et les entreprises jusqu'à 3 personnes. Au-delà, une licence entreprise est requise (remotion.pro).

## Tests

```bash
pnpm --filter @malle/video test
```

La suite valide les props, construit les requêtes Runway avec un `fetch` simulé, couvre les prompts d'animation et la conversion fiche produit → publicité. Elle effectue aussi **un vrai rendu** de 2 s en 360×640, vérifié avec ffprobe (h264).
