# Inventor Studio

Studio de production éditoriale pour concevoir, illustrer, mettre en page, modifier et exporter des livres d'activités pour enfants (sciences, inventions, bricolages, créativité, nature, jeux éducatifs, préscolaire).

Première collection visée : 365 activités créatives, scientifiques et manuelles. L'architecture est indépendante de la collection : chaque livre est un projet, chaque activité vit dans une bibliothèque réutilisable.

## Parcours de production

1. **Nouveau livre** (assistant en 6 étapes) : type, âge, nombre d'activités, style graphique, format, génération du sommaire.
2. **Sommaire** : modifier, supprimer, remplacer, réordonner, ajouter des concepts (ou importer des activités validées de la bibliothèque).
3. **Production par lot** : rédaction des fiches → fiches de référence visuelle → illustrations (finale + étapes) → couverture → assemblage des pages → contrôles qualité. Pause / reprise / annulation / relance, suivi des coûts, journal des erreurs. Rien de déjà produit n'est perdu si une tâche échoue.
4. **Validation humaine** : chaque fiche, chaque illustration (accepter / refuser / régénérer une seule image) et chaque alerte de sécurité est examinée. Une activité dangereuse est bloquée tant qu'un humain ne l'a pas validée. Le système ne certifie jamais la sécurité.
5. **Éditeur visuel** : texte, déplacement et redimensionnement des images, couleurs, typographies, ajout/suppression/duplication/réordonnancement de pages, changement de modèle graphique, annuler/rétablir, sauvegarde.
6. **Export PDF** (A4 imprimable, numérique, activité seule, fiches, couverture, par lot) : chaque export de livre fige un snapshot reproductible, vérifie le nombre de pages, les images manquantes, les débordements et les polices intégrées.

## Pile technique

| Couche | Choix |
|---|---|
| Interface | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, composants Radix |
| Données | PostgreSQL + Prisma 6 (contenus JSON validés par schémas Zod, historique de versions) |
| Tâches asynchrones | pg-boss (file de tâches dans PostgreSQL, reprise sur erreur, pas de Redis) + worker Node séparé |
| IA texte | Adaptateurs Anthropic (Claude), OpenAI, démonstration hors ligne |
| IA image | Adaptateurs OpenAI (GPT Image, avec images de référence pour la cohérence), démonstration étiquetée « DÉMO » |
| Stockage | Local (`./storage`) ou S3 compatible (AWS, R2, MinIO, Scaleway…) |
| PDF | Chromium headless (playwright-core) sur les routes d'impression HTML/CSS, polices auto-hébergées, pdf-lib pour la fusion |

Structure :

```
prisma/              schéma, migrations, seed du projet de démonstration
src/app/(studio)     interface (tableau de bord, livres, activités, bibliothèque, modèles, exports, tâches, paramètres)
src/app/(print)      routes d'impression (rendu fidèle au PDF)
src/app/api          assets, statut des tâches
src/app/actions      server actions (livres, activités, pages, paramètres)
src/lib/schemas      schémas Zod : activité, référence visuelle, couverture, mise en page, paramètres IA
src/lib/ai           adaptateurs texte/image, tarifs, génération structurée (JSON + réparation)
src/lib/generation   sommaire, fiche, référence visuelle, illustrations, couverture (prompts inclus)
src/lib/layout       moteur de mise en page (flux de blocs en mm), thèmes, assemblage du livre
src/lib/quality      contrôles automatiques, évaluation des risques, doublons
src/lib/pdf          rendu Chromium, mesure des débordements
src/lib/export       exports, snapshots
src/lib/queue        pg-boss, jobs, estimation de coût
src/worker           worker de tâches et handlers (pipeline complet)
src/components       UI, rendu de page partagé (aperçu = impression), éditeur WYSIWYG
tests/               tests unitaires (vitest)
```

## Installation locale

Prérequis : Node 22, pnpm, PostgreSQL 14+, Chromium (installé par Playwright ou présent sur la machine).

```bash
pnpm install
cp .env.example .env            # puis renseigner DATABASE_URL, APP_URL, CHROMIUM_PATH…
pnpm db:migrate                 # crée le schéma
pnpm db:seed                    # projet de démonstration « Les Petits Inventeurs »
pnpm dev                        # interface sur http://localhost:3000
pnpm worker                     # dans un second terminal : worker de tâches (obligatoire pour générer/exporter)
```

Sans clé API, les paramètres par défaut utilisent les fournisseurs de démonstration : les textes sont des contenus hors ligne plausibles et les images sont des placeholders clairement marqués « IMAGE DE DÉMONSTRATION » (`isDemo = true`), jamais acceptables comme illustrations définitives. Cela permet de tester tout le parcours (sommaire → fiches → illustrations → pages → PDF).

Pour une génération réelle : définir `ANTHROPIC_API_KEY` et/ou `OPENAI_API_KEY` dans l'environnement du serveur et du worker, puis choisir les fournisseurs dans **Paramètres**. Les clés ne sont jamais exposées au navigateur.

### Chromium

Le rendu PDF utilise `CHROMIUM_PATH` s'il est défini, sinon il cherche `/opt/pw-browsers/chromium`, `/usr/bin/chromium`, `/usr/bin/google-chrome`. Pour installer un Chromium compatible : `npx playwright install chromium` puis pointer `CHROMIUM_PATH` vers l'exécutable.

## Scripts

| Commande | Rôle |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Interface Next.js |
| `pnpm worker` | Worker de tâches (générations, mise en page, exports) |
| `pnpm db:migrate` / `pnpm db:deploy` | Migrations Prisma (dev / production) |
| `pnpm db:seed` | Projet de démonstration |
| `pnpm typecheck` / `pnpm test` | Vérification TypeScript / tests unitaires |
| `pnpm tsx scripts/pipeline.ts <bookId>` | Lance le pipeline complet d'un livre depuis le terminal |
| `pnpm tsx scripts/export.ts BOOK_PRINT <bookId>` | Demande un export PDF depuis le terminal |
| `pnpm tsx scripts/screenshot.ts <url> <png>` / `scripts/measure.ts` | Capture d'une route d'impression / mesure des débordements |

## Projet de démonstration

`pnpm db:seed` crée le livre **« Les Petits Inventeurs — 10 inventions extraordinaires »** (6-9 ans, style aquarelle, A4 portrait) avec 10 concepts d'activités et l'activité pilote **« Construis ta voiture propulsée par un ballon »** entièrement rédigée à la main (fiche pédagogique, instructions, consignes de sécurité, fiche de référence visuelle).

Parcours de test réalisé de bout en bout : illustrations (6 images de démonstration), assemblage automatique (9 pages : couverture, présentation, sommaire, 3 pages d'activité, conclusion, diplôme, quatrième de couverture), export PDF A4 (9 pages, Nunito intégrée, 0 image manquante, 0 débordement).

## Déploiement

- **Interface** : Vercel (ou tout hébergeur Node). Variables : `DATABASE_URL`, `APP_URL`, `STORAGE_DRIVER=s3` + variables `S3_*`, clés IA.
- **Worker** : un service Node longue durée (Railway, Render, Fly.io, VM, conteneur) exécutant `pnpm worker` avec les mêmes variables, `APP_URL` pointant vers l'interface publique (le worker charge les routes `/print/*` pour produire les PDF) et un Chromium disponible. Les générations d'images et les exports ne tournent jamais dans des fonctions serverless à délai court.
- **Base de données** : PostgreSQL managé (Neon, Supabase, RDS…). `pnpm db:deploy` au déploiement.
- **Stockage** : bucket S3 compatible ; `S3_PUBLIC_BASE_URL` facultatif pour servir les images via CDN.
- **Accès** : l'application ne contient pas encore d'authentification ; placer l'interface derrière une protection (Vercel Password Protection, SSO, proxy) avant toute exposition publique.

## Principes de qualité intégrés

- Contenus JSON validés par schéma, identifiant unique et historique de versions par activité, détection de doublons et d'activités trop similaires.
- Fiche de référence visuelle par activité (objet final, forme, couleurs, matériaux, dimensions, pièces, apparence à chaque étape) injectée dans chaque prompt ; les images déjà acceptées servent de références aux générations suivantes.
- Aucune image générée n'est considérée comme validée : statut « À vérifier » jusqu'à acceptation humaine ; les images de démonstration sont marquées en permanence (ruban « DÉMO », `isDemo`).
- Contrôles automatiques : champs manquants, structure, étapes incohérentes, matériel absent des instructions, durée aberrante, lisibilité, typographie, illustrations manquantes/refusées/basse résolution, doublons, risques (outils, petites pièces, substances, chaleur, électricité) avec blocage en attente de validation humaine.
- Moteur de mise en page : marges, pas de texte coupé (mesure réelle des débordements au rendu), images non déformées, numérotation automatique, nombre de pages adapté à la longueur de chaque activité, aperçu identique au PDF (même composant de rendu).
- Exports reproductibles à partir d'un snapshot versionné du livre.

## Limites connues / prochaines étapes

- Pas d'authentification ni de gestion multi-utilisateurs.
- Le fournisseur d'images réel implémenté est OpenAI ; d'autres fournisseurs se branchent via l'interface `ImageProvider` (`src/lib/ai/image`).
- La validation visuelle est humaine ; une pré-évaluation automatique par modèle multimodal peut être ajoutée dans `src/lib/quality`.
- La correction orthographique est heuristique (typographie, répétitions) ; brancher un correcteur dédié si nécessaire.
