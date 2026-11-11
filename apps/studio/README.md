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

## Kits, brief collé et catalogue de la boutique

### Types de kits

Le studio produit des **kits** alignés sur le catalogue de la boutique (référentiel `src/lib/kits/types.ts`) : chasse au trésor, mission / enquête, kit d'anniversaire, chasse aux œufs de Pâques, jeu d'Halloween, lutins farceurs, activités de Noël, cahier d'activités, jeux de logique, Montessori, histoire illustrée, histoires du soir, livre personnalisable (les anciens livres d'activités — inventions, sciences… — restent disponibles). Chaque type définit sa catégorie et son modèle de fiche boutique, l'âge et le prix par défaut, et sa structure (ex. chasse au trésor : guide, lettre, 10 énigmes texte + 10 énigmes images, carte en 10 morceaux, 6 défis, diplômes, invitations).

Les kits structurés (chasse au trésor et dérivés, lutins farceurs, Noël) stockent leur contenu dans `Book.kitContent` (schémas `src/lib/kits/schemas.ts`, même format que les prompts de `docs/prompts`). Leurs pages sont produites par les gabarits de `src/lib/kits/pages.ts` : lettre pleine page, cartes énigmes 4 par page (texte et images), carte au trésor découpée en 10 morceaux, défis, diplômes et invitations 2 par page, idée de farce 1 par page, calendrier 24 cases, petits mots à découper, guide. Les illustrations sont rattachées par emplacement (`Illustration.kind = KIT`, `slot` : `lettre`, `carte`, `enigme-image-3`, `idee-12`…).

**Assistant « Nouvel e-book »** : univers de la boutique, type d'e-book, univers du récit, personnage, compagnon, lieu ou véhicule, nombre d'éléments, âge (3–5, 5–8, 8–10, 3–10), ton, prix et catégorie boutique, style et format, puis production complète en un clic (contenu → illustrations → couverture → pages). La page du livre affiche un onglet **Kit** : contenu, illustrations par emplacement (refaire une image), réécriture du contenu, réassemblage, et import d'un JSON collé.

### Créer depuis un brief

`/brief` : collez une demande libre (« Fais-moi une chasse au trésor dinosaures pour les 5-8 ans… »), un prompt de `docs/prompts`, ou directement le **JSON complet** obtenu avec ce prompt dans Claude ou ChatGPT.
- JSON complet reconnu (`enigmes`, `idees`, `boutique`…) → importé tel quel, sans appel IA pour le texte ;
- brief libre en mode API → l'IA configurée en déduit un plan (type, titre, âge, univers, personnages, nombre d'éléments, prix, catégorie) ;
- brief libre en mode copier-coller → le studio affiche le prompt à copier, puis on colle le JSON obtenu et on relance l'analyse.

Le plan est modifiable, puis « Créer le kit et lancer la production » démarre tout le pipeline (publication boutique automatique à l'export si activée).

### Catalogue de la boutique

`/shop` liste tous les produits de la boutique (tous statuts) avec prix, ventes, liens vers la fiche et l'admin, et le livre lié. Un produit existant (ex. la Capitaine Coquelicot) s'**importe dans le studio** en un clic : livre lié (même produit, jamais dupliqué), fiche commerciale préremplie, image principale reprise comme couverture. Le tableau de bord affiche l'encart « Dans la boutique » (publiés, brouillons à valider, meilleures ventes avec revenus) et chaque livre lié ses ventes (total et 30 derniers jours, via `GET /api/v1/products/:id/stats`).

### Paramètres du studio

Paramètres → Studio : nom affiché (« La Malle à Jeux · Studio »), auteur / collection par défaut, prix par défaut par type d'e-book. Les **chartes d'illustration** se règlent par préréglage d'univers (Paramètres → Univers).

## Multi-univers (Plateforme → Audiences → Univers)

La boutique héberge plusieurs **univers** (sites) regroupés par **audience** ; le studio les lit avec `GET {boutique}/api/v1/sites` (cache 60 s, bouton « Actualiser » dans Paramètres → Univers). Si la boutique n'est pas reliée ou répond 404 sur `/sites`, le studio se replie sur un seul univers « La Malle à Jeux » (`la-malle-a-jeux`, préréglage kit-enfants) avec les catégories actuelles : tout continue de fonctionner comme avant.

Chaque univers porte un **préréglage** (`src/lib/universes/presets.ts`) qui fixe le prompt système et le ton, la charte d'illustration (surchargeable par préréglage), le style d'image, le thème PDF et les types d'e-books autorisés :

| Préréglage | Types autorisés | Thème PDF | Contenu |
|---|---|---|---|
| `kit-enfants` | chasses au trésor, missions, lutins, Noël, cahiers… | La Malle à Jeux | kits actuels |
| `guide-expert` | `guide-pratique` (fiche `GUIDE`) | Guide expert | introduction, sommaire, problème/causes, diagnostic, chapitres (étapes, encadrés Conseil/Attention, tableaux), erreurs, checklist ☐, calendrier, FAQ, glossaire, sécurité |
| `recettes` | `livre-recettes` (fiche `RECIPES`) | Recettes | une page par recette (portions, temps, ingrédients, étapes, astuce, allergènes) |
| `sciences-enfants` | `fiches-sciences` (fiche `ACTIVITY`) | Labo des curieux | une page par expérience + règles du labo + diplôme |

- `Book.siteSlug` (migration `20261108220000_universes`, avec `Book.shopPublicUrl`) mémorise l'univers ciblé ; la fiche envoyée à la boutique contient `siteSlug`, et le lien « Voir la fiche » utilise le `publicUrl` renvoyé (domaine de l'univers).
- **Choix de l'univers** : sélecteur groupé par audience (statut actif / en test affiché) dans `/brief`, l'assistant « Nouvel e-book » (étape 1, préréglage présélectionné, types filtrés), le formulaire de plan (catégories de l'univers) et le pilote automatique. En « automatique », le plan proposé à partir du brief choisit l'univers (`siteSlug`) parmi les univers actifs ; le studio vérifie la compatibilité type ↔ préréglage.
- `/shop` filtre le catalogue par univers (`?site=`) et affiche l'univers de chaque produit ; l'import reprend l'univers du produit.
- Contrôle qualité des guides : nombre de chapitres, chapitres vides, section Sécurité obligatoire dès qu'un produit chimique est évoqué, promesses irréalistes (« garanti », « miracle », « infaillible », « sans effort ») bloquantes.
- Prompt modèle copier-coller : `docs/prompts/guide-pratique-modele.md` (exemple « Fini l'eau verte : retrouver une piscine claire en 72 h »). Le mode démo (`mock`) produit un guide piscine complet de bout en bout.

`pnpm tsx scripts/dev-kit-smoke.ts [chasse-au-tresor|lutins-farceurs]` produit un kit complet en mode démonstration, sans worker, pour vérifier le pipeline.

## Aperçu

Chaque livre a une page **Aperçu** (`/books/<id>/apercu`, bouton orange « Aperçu » sur la fiche du livre, onglet « Aperçu », lien « Aperçu du livre » dans le suivi du pilote automatique, et ouverture automatique après une production lancée depuis le brief).

- **Même rendu que le PDF** : les pages sont dessinées par le même moteur (`PageRenderer`) que la route d'impression utilisée par Chromium. Ce que vous voyez est ce qui sera imprimé.
- **Visionneuse** : double page (couverture seule), tourne-page léger (désactivé si le système demande de réduire les animations), flèches du clavier / Page précédente-suivante / Début-Fin, glisser du doigt, miniatures, zoom ajusté / 100 % / 200 %, plein écran, bascule page simple / double page ; page simple automatiquement sur téléphone.
- **Contrôles** (calque activable) : fond perdu (bande de 3 mm), marges de sécurité (pointillés), cadres des images (cliquables), badges d'alerte par page : texte qui déborde (même règle que l'export PDF), basse résolution, recadrage conseillé, image presque unie, image manquante, esquisse. Chaque alerte propose son action : **Recadrer**, **Remplacer par un fichier**, **Regénérer cette image**, **Modifier le texte** (ouvre l'éditeur sur la page).
- **En-tête** : titre, univers, type, nombre de pages, coût cumulé, état des images (esquisses / version finale), boutons **Exporter le PDF**, **Télécharger le PDF**, **Publier / mettre à jour en boutique**, **Partager un lien d'aperçu**.
- **Lien partagé** : `/preview/<jeton>`, lecture seule, signé (HMAC), valable 7 jours, accessible sans le mot de passe du studio (le middleware laisse passer `/preview/…` ; les images y sont servies avec `?pt=<jeton>` et la route d'asset vérifie que l'image appartient bien au livre). Secret : `PREVIEW_SECRET` (à défaut `STUDIO_PASSWORD`, puis `INTERNAL_TOKEN`) ; changer ce secret invalide tous les liens.
- **Vignettes** : l'accueil et la liste des livres montrent la couverture et les 3 premières pages (clic → aperçu).

## Cadrage et économies

Objectif : une image juste du premier coup, et ne jamais payer deux fois la même illustration.

**1. Format juste dès la génération.** Chaque emplacement déclare son format cible (`src/lib/images/framing.ts`) : portrait 2:3 → 1024 × 1536 (énigmes en images, carte, diplôme, certificat, invitation, visuel Story), paysage 3:2 → 1536 × 1024 (lettres, idées, chapitres, recettes, expériences, planche de personnages), carré → 1024 × 1024 (couverture, résultat final, étapes, visuel héros). La taille est la même en démo et en copier-coller (le prompt à coller indique le format). Le prompt reçoit des consignes de composition : sujet centré dans la zone utile, marges de sécurité de 10 %, zones laissées libres quand la page pose du texte (diplôme, invitation, lettre, Story), « aucun texte dans l'image ». Les cadres des gabarits (diplôme, idées, guide, flux des guides/recettes/expériences, couverture) ont été redimensionnés pour rester à moins de 25 % de ces formats.

**2. Cadrage sans regénération.** Chaque illustration a un point focal (`focalX`, `focalY`, 0–1), un zoom (1–3) et un ajustement (`cover` = remplir, `contain` = ajuster, vide = automatique). Le point focal est détecté gratuitement à la création (sharp, stratégie « attention », repli « entropy ») ; le cadrage manuel n'est jamais écrasé. Le rendu applique `object-fit` / `object-position` + zoom, sans déformation ; au-delà de 25 % d'écart de format l'image passe automatiquement en « ajuster », sur un fond tiré de l'image (couleur moyenne + image floutée, jamais de bandes noires). L'**éditeur de cadrage** (depuis l'aperçu ou « Cadrer · refaire » dans l'onglet Kit) : glisser le point d'intérêt, zoom, remplir / ajuster / auto, « Recadrage automatique », Enregistrer → les pages sont mises à jour sans aucun appel IA.

**3. Contrôle des images** (`src/lib/quality/images.ts`) : résolution à l'impression (alerte sous 150 ppp, blocage sous 100 ppp), écart de format > 25 %, image presque unie, image manquante, esquisse. Les alertes s'affichent dans l'aperçu ; l'étape « Mise en page » du pilote automatique les résume et n'échoue que sur un problème bloquant.

**4. Économiser les générations.**
- **Mode esquisse** (Paramètres → IA, et activé par défaut dans le pilote automatique) : les images sont d'abord produites en qualité basse (≈ 0,01 $ l'image avec gpt-image-1), l'aperçu est assemblé, puis « **Valider les esquisses et générer la version finale** » ne reprend que les esquisses retenues, en qualité finale, avec le même prompt et l'esquisse en image de référence (`images.edit`) pour garder la composition. Les coûts esquisse / finale sont affichés avant confirmation.
- **Pilote automatique** : l'étape « Illustrations » produit les esquisses, s'arrête pour validation dans l'aperçu (désactivable : « Valider les esquisses… » décoché = version finale directement ; « Esquisses d'abord » décoché = tout en final directement), puis génère les versions finales.
- **Jamais de regénération implicite** (`src/lib/generation/regen-policy.ts`) : relancer un pipeline conserve toute image acceptée, générée ou collée, ainsi que la couverture existante ; seules les images absentes, échouées, refusées (ou de démonstration quand un vrai fournisseur est configuré) sont produites.
- **Regénérer une image** est toujours volontaire : coût estimé et confirmation, recadrage gratuit proposé d'abord, « Regénérer avec correction » (texte libre ajouté au prompt, image actuelle en référence) ou nouvelle image ; « Remplacer par un fichier » ne coûte rien. La nouvelle version remplace l'ancienne dans les pages sans les reconstruire.

## Mode copier-coller (sans clé API)

Le studio fonctionne aussi **sans aucune clé API** : les prompts sont copiés dans l'assistant de votre choix (Claude.ai, ChatGPT…) et les réponses collées dans le studio.

- **Bascule** : bouton « Mode API / Mode copier-coller » en bas de la barre latérale (ou Paramètres → Mode de génération). Le périmètre est réglable : textes et images, images seulement (ex. Claude via API pour les textes, ChatGPT en copier-coller pour les images) ou textes seulement.
- **Fonctionnement** : le pipeline est inchangé. Quand une génération est nécessaire, le studio enregistre une *demande à coller* (prompt complet, format attendu) et met la tâche en statut **« Réponses à coller »** sans rien perdre de ce qui est déjà produit. Chaque demande n'est créée qu'une fois (empreinte du prompt).
- **Page « À coller »** : pour chaque demande, « Copier le prompt », « Ouvrir Claude » / « Ouvrir ChatGPT », puis zone de collage (texte, validé avec le même schéma que le mode API ; les balises ```json et le texte autour sont nettoyés) ou téléversement de l'image (PNG, JPG, WebP). « Tout copier » regroupe les demandes texte d'un livre en un seul prompt, et « Coller plusieurs réponses » accepte la réponse groupée (sections `### DEMANDE <identifiant>`).
- **Reprise automatique** : dès que toutes les réponses d'une tâche sont fournies, elle est remise dans la file (le worker doit tourner) et continue jusqu'à la prochaine demande ou la fin. Les images collées ont le statut « À vérifier » comme toute illustration générée ; le coût enregistré est 0.
- **Annuler une demande** laisse la tâche en attente avec un message explicite ; la relancer recrée la demande.

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

Le studio se déploie en deux services qui partagent la même base PostgreSQL et le même stockage S3 :

| Service | Hébergement conseillé | Rôle |
|---|---|---|
| Interface (Next.js) | **Vercel**, Root Directory `apps/studio`, build `pnpm build` (migrations + build automatiques) | Pages, server actions, routes `/print` utilisées par le worker |
| Worker | **Railway** ou Render, Dockerfile `apps/studio/Dockerfile.worker` (contexte = racine du dépôt) | Générations IA, mise en page, export PDF (Chromium inclus dans l'image) |
| Base | Neon (ou autre PostgreSQL) | `DATABASE_URL` + `DATABASE_URL_UNPOOLED` ; sur Vercel les tables vont dans le schéma `studio` (`DB_SCHEMA`) |
| Stockage | Cloudflare R2 / S3 compatible, bucket privé | Obligatoire en ligne (`STORAGE_DRIVER=s3`) : le web et le worker doivent voir les mêmes fichiers |

Variables à définir **sur les deux services** : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DB_SCHEMA=studio`, `STORAGE_DRIVER=s3`, `S3_*`, `INTERNAL_TOKEN` (identique des deux côtés), `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, `SHOP_API_URL`, `SHOP_API_KEY`. Côté web uniquement : `STUDIO_PASSWORD` (mot de passe d'accès, 8 caractères minimum). Côté worker uniquement : `APP_URL` = URL publique du studio (le worker y charge les routes `/print` avec le jeton interne pour produire les PDF).

### Worker sur votre ordinateur (option gratuite)

Le worker n'a pas besoin d'être hébergé : copiez `.env.production.example` en `.env.production` (base Neon, bucket R2, `APP_URL` du studio en ligne, `INTERNAL_TOKEN`), puis lancez `pnpm worker:prod` le temps de produire un livre. Les tâches en attente sont traitées, les PDF rendus avec le Chromium local (`npx playwright install chromium` la première fois), puis vous arrêtez le worker. Pour un worker allumé en permanence, utilisez Railway/Render avec `Dockerfile.worker`.

Accès : avec `STUDIO_PASSWORD` défini, toute l'interface demande le mot de passe (page `/connexion`, cookie 30 jours). Les routes `/print` et `/api/assets` restent accessibles au worker grâce à `INTERNAL_TOKEN`.

## Principes de qualité intégrés

- Contenus JSON validés par schéma, identifiant unique et historique de versions par activité, détection de doublons et d'activités trop similaires.
- Fiche de référence visuelle par activité (objet final, forme, couleurs, matériaux, dimensions, pièces, apparence à chaque étape) injectée dans chaque prompt ; les images déjà acceptées servent de références aux générations suivantes.
- Aucune image générée n'est considérée comme validée : statut « À vérifier » jusqu'à acceptation humaine ; les images de démonstration sont marquées en permanence (ruban « DÉMO », `isDemo`).
- Contrôles automatiques : champs manquants, structure, étapes incohérentes, matériel absent des instructions, durée aberrante, lisibilité, typographie, illustrations manquantes/refusées/basse résolution, doublons, risques (outils, petites pièces, substances, chaleur, électricité) avec blocage en attente de validation humaine.
- Moteur de mise en page : marges, pas de texte coupé (mesure réelle des débordements au rendu), images non déformées, numérotation automatique, nombre de pages adapté à la longueur de chaque activité, aperçu identique au PDF (même composant de rendu).
- Exports reproductibles à partir d'un snapshot versionné du livre.

## Grands volumes (120 dessins et plus)

Aucun plafond éditorial sur le nombre d'éléments ni d'images : seule la constante `MAX_ITEMS_PER_BOOK` (500, `src/lib/kits/limits.ts`)
protège la plateforme. Un cahier de coloriage de 120 dessins, un recueil de 200 recettes ou une chasse de 40 énigmes se
produisent comme un kit de 10 éléments.

- **Texte par lots** (au-delà de 20 éléments) : sommaire de tous les titres (aucun doublon possible), puis cadre du livre
  avec les 15 premiers éléments, puis lots de 15. Les lots sont indépendants : en parallèle par l'API, ou collés dans
  n'importe quel ordre en copier-coller (leur prompt ne dépend que du sommaire). Chaque lot validé est conservé
  (`Book.kitDraft`) : une reprise ne relance que le lot manquant ; un lot tronqué est relancé seul, en deux moitiés.
  Fusion sans doublons, renumérotation, lot complémentaire si des éléments manquent.
- **Images en file** : concurrence réglable (Paramètres → IA → « Générations simultanées », 1 à 10), reprise image par
  image (une image faite n'est jamais refaite), progression « Illustrations 37/120 », budget par livre vérifié avant
  chaque image (relancer reprend où le budget s'est arrêté). La planche de personnages, ou le premier dessin, passe d'abord.
- **Coût** : estimation par poste avant lancement (« 123 images × 0,017 $ + couverture 0,17 $ = 2,20 $ ») ; le plafond
  de coût du pilote automatique affiche ce détail quand il s'arrête.
- **PDF** : au-delà de 40 pages, rendu par tranches de 30 pages fusionnées avec pdf-lib ; délais proportionnels au
  nombre de pages. Le PDF « numérique léger » sert des images allégées (JPEG 1600 px, PNG 2 couleurs pour un dessin au
  trait, SVG tel quel) ; le PDF « qualité d'impression » garde les originaux.
- **Aperçu** : miniatures rendues à l'approche (IntersectionObserver) avec des vignettes 320 px, page affichée en 1400 px
  (déclinaisons `?v=thumb|screen|digital` de `/api/assets`, calculées une fois et mises en cache). Onglet Kit :
  illustrations filtrées (à générer, faites, démo, esquisses) et paginées par 48.
- **Boutique** : couverture + 8 aperçus répartis sur le livre (au lieu des 3 premières pages) ; un PDF de plus de 4 Mo
  est déposé directement dans le stockage privé de la boutique par URL signée (limite de 4,5 Mo des requêtes Vercel),
  jusqu'à 500 Mo. Etsy : 10 images et 20 Mo par fichier (préférez le PDF numérique léger).

### Cahier de coloriage (`cahier-coloriage`)

Univers « Kit enfants » et « Sciences enfants », catégorie `activites-educatives`, gabarit `ACTIVITY`. Une page A4 portrait par
dessin (dessin non rogné sur fond blanc, titre en pied), page « Ce cahier appartient à… », exemple colorié (premier dessin
mis en couleur, il sert de référence), sommaire facultatif, diplôme « Artiste en herbe », option recto-verso (page blanche
au dos de chaque dessin), prénom ou ligne à compléter sur la couverture (en couleur). Complexité selon l'âge (3–5 très
simple, 6–8 moyen, 8–10 détaillé). Charte « coloriage » éditable (Paramètres → Univers) ; chaque dessin est contrôlé
(sharp) et converti en noir et blanc pur par seuillage, sans regénération.

Images : par l'API par défaut avec des réglages propres au type (`gpt-image-1-mini` medium, sans esquisse ; couverture
`gpt-image-1` high), modifiables dans Paramètres → IA et dans le plan, avec le mode mixte « Texte : copier-coller ·
Images : API OpenAI ». En copier-coller, **une seule** demande « Lot d'images » (prompt maître, planches 2×2 par défaut,
1 ou 3×3 en option), dépôt groupé (fichiers ou ZIP, tri par nom puis date, réordonnables), découpage automatique
(gouttières détectées par profils de projection, repli régulier), rognage, noir et blanc, vectorisation du trait
(imagetracerjs, domaine public ; potrace est sous GPL, écarté) avec repli raster agrandi, écran de vérification
(permuter, rejeter → demande individuelle ou API, régler la découpe), puis « Valider » : la production reprend seule.
Le lot est propre au coloriage (les autres kits mélangent formats et personnages récurrents, peu adaptés aux planches).

Modèle de prompt : `docs/prompts/cahier-coloriage-modele.md`. Démonstration : `pnpm tsx scripts/demo-coloring.ts`.

## Limites connues / prochaines étapes

- Pas d'authentification ni de gestion multi-utilisateurs.
- Le fournisseur d'images réel implémenté est OpenAI ; d'autres fournisseurs se branchent via l'interface `ImageProvider` (`src/lib/ai/image`).
- La validation visuelle est humaine ; une pré-évaluation automatique par modèle multimodal peut être ajoutée dans `src/lib/quality`.
- La correction orthographique est heuristique (typographie, répétitions) ; brancher un correcteur dédié si nécessaire.

## Pilote automatique (du brief à la campagne)

Page **Créer depuis un brief** → bouton **« Tout lancer en automatique »** : collez un brief libre, un prompt de `docs/prompts`, ou directement le JSON obtenu avec ce prompt. Le studio affiche les réglages appliqués et le coût estimé, puis enchaîne sans intervention :

| # | Étape | Ce qui est fait |
|---|---|---|
| 1 | Plan | Brief → type de kit, personnages, univers, prix (JSON complet : import direct, aucun appel IA) |
| 2 | Rédaction | Énigmes / idées, lettres, défis, guide, fiche boutique |
| 3 | Contrôles qualité | Nombre d'éléments, champs obligatoires, longueurs ; corrections sûres automatiques ; blocage sur marque sous licence ou faux avis |
| 4 | Planche de personnages | Générée en premier, puis jointe comme image de référence à toutes les illustrations et à la couverture |
| 5 | Illustrations | Tous les emplacements du kit + couverture + visuel carré « héros » + visuel vertical publicitaire (tâche « Production du livre ») |
| 6 | Mise en page | Assemblage des pages |
| 7 | PDF | Export numérique (+ imprimable si activé) ; débordements corrigés automatiquement (police réduite, 2 tentatives), sinon arrêt |
| 8 | Boutique | Fiche, couverture, aperçus, PDF privé, coût de création ; publication directe ou brouillon à valider |
| 9 | Etsy (facultatif) | « Publier aussi sur Etsy » : `POST /api/v1/products/:id/etsy` de la boutique (fiche brouillon ou active, 0,20 $ de mise en vente) ; sans boutique Etsy connectée (409) ou produit incomplet pour Etsy (422), l'étape est **ignorée** avec l'explication et le run continue |
| 10 | Vidéos pub | Formats choisis, clip Runway si activé et sous le plafond (sinon montage seul), envoi à la boutique |
| 11 | Publicités | `POST /api/v1/products/:id/marketing/autopilot` de la boutique ; si la boutique n'a pas de clé Claude (409), le studio rédige les textes (IA du studio ou demande « À coller ») |

Suivi : page **Pilote automatique** (barre latérale, badge des runs actifs) avec la frise des 11 étapes, durées, coûts, liens (kit, PDF, fiche boutique, admin, vidéos, campagne) et les actions **Reprendre**, **Relancer l'étape**, **Valider et continuer**, **Annuler**. Chaque étape est idempotente : une reprise ne refait jamais ce qui est terminé.

Réglages (**Paramètres → Pilote automatique**) : étapes actives, publication directe ou brouillon, PDF imprimable, formats et durée des vidéos, clip d'accroche, canaux, variantes, posts en brouillon ou programmés (décalage, espacement), budget quotidien indicatif, points de validation (après rédaction, après illustrations, avant boutique, avant publicités : par défaut seulement si les posts sont programmés), **plafond de coût par e-book** (10 $ par défaut : au-delà, le run attend une validation).

Prérequis : le worker doit tourner (`pnpm worker`, ou `pnpm worker:prod` contre le studio en ligne) et le studio doit être joignable à `APP_URL` (rendu PDF). Pour un enchaînement 100 % automatique : clés Claude et OpenAI (studio), boutique configurée (Paramètres → Boutique). En mode copier-coller, le run s'arrête sur chaque demande « À coller » et reprend tout seul dès qu'elle est résolue. Le coût de création envoyé à la boutique est converti approximativement de $ en € (0,92).

## Publication vers la boutique

Le studio est relié à la boutique (`apps/shop`) par son API v1 (`apps/shop/docs/API.md`). À chaque **export PDF de livre** terminé (numérique, ou imprimable s'il n'existe pas de version numérique), le worker crée ou met à jour la fiche produit correspondante et la **publie automatiquement** : la landing page dédiée (`/aventures/<slug>`) est en ligne sans intervention.

Configuration : **Paramètres → Boutique** (URL de la boutique, clé API créée dans l'admin de la boutique avec les scopes `products:write` et `products:publish`, publication immédiate ou brouillon à valider, prix / catégorie / modèle par défaut, bouton « Tester la connexion »). Variables d'environnement de repli : `SHOP_API_URL`, `SHOP_API_KEY`.

Pour chaque livre, l'onglet **Boutique** de la page du livre affiche l'état de synchronisation (jamais publié, brouillon à valider, publié avec liens public et admin), permet d'éditer la fiche commerciale (prix, sous-titre, descriptions, catégorie, modèle de fiche, FAQ, SEO) et de publier ou re-synchroniser à la demande. Les champs vides sont dérivés du livre : titre, sous-titre, introduction, sommaire des activités (contenu du kit), tranche d'âge, nombre de pages, matériel.

Ce qui est envoyé : la fiche, la couverture acceptée (image principale), jusqu'à trois aperçus de pages intérieures (rendus par Chromium depuis la route d'impression) et le PDF exporté (stockage privé, livré uniquement après paiement). La synchronisation est idempotente : un livre déjà publié est mis à jour, jamais dupliqué (slug stable `titre-<fin de l'identifiant>`).

Scripts : `pnpm tsx scripts/dev-publish-to-shop.ts <bookId> [--draft] [--no-previews]`.

Note technique : le studio épingle Prisma `6.19.2` tandis que la boutique utilise `6.19.3`. Avec une version identique, pnpm partage un seul paquet `@prisma/client` entre les deux applications et chaque `prisma generate` écrase le client de l'autre.

## Vidéos publicitaires

Chaque livre a un onglet **« Vidéos pub »**, et la page **Vidéos** regroupe les vidéos de tous les livres.

1. **Formulaire** : formats (Story 9:16, Carré 1:1, Paysage 16:9), durée de 6 à 20 s, accroche, 2 ou 3 bénéfices et appel à l'action. Ces champs sont préremplis depuis la fiche boutique. La musique est facultative.
2. **Clip d'accroche animé** (facultatif) :
   - **Runway** : l'illustration choisie est animée par Gen-4 Turbo (5 ou 10 s). Le coût estimé s'affiche avant le lancement. Le worker interroge Runway toutes les 10 s, pendant 10 min au plus.
   - **Copier-coller** : le prompt de mouvement est affiché, à utiliser dans Runway, Sora ou Veo. Le clip MP4 se téléverse ensuite dans « À coller » (demande de type vidéo, image de départ téléchargeable). Le montage reprend automatiquement.
   - **Démo** (développement uniquement) : un petit clip est monté localement, sans appel externe.
3. **Montage** : le worker monte la vidéo avec Remotion (paquet `@malle/video`) à partir de la couverture, des illustrations du kit, du prix et du logo. Il produit un MP4 et une miniature, stockés comme Assets.
4. **Envoi à la boutique** : si le livre est lié à un produit, la vidéo y est envoyée automatiquement. Elle devient un média VIDEO du produit, proposé dans Marketing social → Posts. Sinon, utilisez le bouton « Envoyer à la boutique » une fois le livre publié.

Le montage est toujours réalisé par le worker : lancez `pnpm worker`, ou `pnpm worker:prod` contre le studio en ligne. Le worker utilise le Chromium local et le ffmpeg fourni par Remotion. Les fichiers de travail sont dans `VIDEO_WORK_DIR`, par défaut le dossier temporaire du système.

Réglages dans **Paramètres → Vidéo** :
- clé Runway, stockée côté serveur ; à défaut, la variable `RUNWAY_API_KEY` ;
- coût estimé par seconde, 0,05 $ par défaut ;
- durée par défaut ;
- musique par défaut et son volume.
