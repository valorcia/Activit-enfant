# AUDIT_UNWRITTEN — Phase 0 : audit du dépôt existant

> Date : 17 novembre 2026 · Périmètre : monorepo `valorcia/Activit-enfant` (branche `claude/inventor-studio`, 73 commits, ≈ 50 000 lignes TypeScript).
> Méthode : lecture du code, des schémas Prisma, des scripts de build et de déploiement, exécution des suites de tests. Chaque affirmation ci-dessous a été vérifiée dans le code ; ce qui ne l'a pas été est signalé « non vérifié ».

## Légende
- ✅ **Opérationnel** : en production ou testé de bout en bout.
- 🟡 **Partiel** : existe, mais insuffisant pour UNWRITTEN.
- ❌ **Absent** : à construire.
- 🔧 **Configuration** : dépend d'un réglage ou d'un compte externe.

---

## 1. Vue d'ensemble

| Élément | Constat |
|---|---|
| Organisation | Monorepo pnpm : `apps/shop` (boutique), `apps/studio` (studio de production), `packages/video` (vidéos Remotion + Runway). |
| Marque en service | **La Malle à Jeux** (boutique `www.lamalleajeux.eu`, studio `studio.lamalleajeux.eu`). Ne doit pas être perturbée. |
| Hébergement | Vercel (boutique et studio, offre Hobby : crons quotidiens seulement), worker du studio sur un serveur Hetzner (Docker, 1 Go de RAM, 20 Go de disque), base Neon (PostgreSQL, schémas `shop` et `studio` séparés), stockage Cloudflare R2. |
| Tests | Boutique : 160 tests (vitest + base PostgreSQL réelle). Studio : 170 tests. Intégration continue GitHub Actions **pour la boutique seulement** (`.github/workflows/ci.yml`). |

## 2. Les 15 points demandés

### 2.1 Framework frontend
- **Boutique** : Next.js 16 (App Router, React 19, `proxy.ts`), Tailwind CSS 4, Radix UI, framer-motion, zustand (panier). ✅
- **Studio** : Next.js 15, React 19, Tailwind 4, Radix. ✅
- Rendu mobile vérifié à 390 px sur toutes les pages (novembre 2026). ✅

### 2.2 Backend
- Routes API et Server Actions Next.js dans chaque application. ✅
- **API v1 de la boutique** à clé (scopes `products:*`, `creators:*`) consommée par le studio. ✅
- **Worker** Node.js (`apps/studio/src/worker`) : file **pg-boss** sur PostgreSQL. ✅

### 2.3 Bases de données
- PostgreSQL (Neon) avec Prisma 6 :
  - boutique : **45 modèles** (produits, commandes, paiements, remboursements, droits de téléchargement, univers `Site`, audiences, marketing, Etsy, créatrices…) ;
  - studio : **19 modèles** (livres, pages, illustrations, exports, tâches, journal des coûts `GenerationLog`, pilote automatique…). ✅
- Isolation par schéma PostgreSQL (`shop` / `studio`) ; migrations appliquées au build (`scripts/build.mjs`, avec reprise P3005). ✅

### 2.4 Authentification
- **Administrateurs boutique** : Auth.js v5 (identifiants + bcrypt), rôles (ADMIN, EDITOR, MARKETING, SUPPORT) et permissions fines. ✅
- **Clients** : **aucun compte**. Accès aux achats par liens signés envoyés par e-mail (« Retrouver mes achats ») et jetons de téléchargement. ✅ (adapté au besoin, mais 🟡 pour la « bibliothèque client » d'UNWRITTEN)
- **Créatrices** : lien magique à usage unique, cookie de session séparé. ✅
- **Studio** : mot de passe partagé unique (`STUDIO_PASSWORD`) + jeton interne pour le worker. 🟡 (pas de comptes individuels ni de rôles)

### 2.5 Modèles d'IA utilisés
- **Texte** : Anthropic (`claude-opus-5-5` par défaut, choix Sonnet 5.5 / Haiku 5.5 / Fable 5.1) ou OpenAI (gpt-5, gpt-5-mini, gpt-4.1), avec réflexion adaptative et effort « high » (`apps/studio/src/lib/ai/text/anthropic.ts`). ✅
- **Mode copier-coller** sans clé : demandes à coller dans Claude ou ChatGPT. ✅
- **Sortie structurée** : JSON validé par Zod, réparation automatique, relance si la réponse est coupée, textes trop longs raccourcis (`lib/ai/structured.ts`). ✅
- **Un seul modèle par livre pour toutes les étapes.** Il n'y a pas d'échelonnement des modèles par tâche (classification, extraction et rédaction utilisent tous le même modèle). 🟡 Levier d'économie majeur, voir § 4.

### 2.6 Génération d'images
- **OpenAI** `gpt-image-1` / `gpt-image-1-mini` (génération et édition avec images de référence), repli automatique si un modèle est indisponible pour le compte. ✅
- **Mode esquisse** (qualité basse puis version finale après validation), cadrage par point focal sans régénération, contrôle de résolution, conversion au trait pour les coloriages. ✅
- **Cohérence des personnages** : planche de personnages utilisée comme référence pour les illustrations suivantes. 🟡 (pas de « bible visuelle » formalisée par livre, pas de contrôle automatique de cohérence)

### 2.7 Moteur de génération PDF
- **Rendu** :
  - pages composées en blocs positionnés en millimètres (`PageLayout`), affichées par un composant React ;
  - le PDF est imprimé par **Chromium (Playwright)**, assemblé par tranches avec `pdf-lib`.
- **Deux sorties** : numérique (images allégées) et impression (originaux, fond perdu et zones de sécurité visibles dans l'aperçu).
- **Contrôles** :
  - débordements de texte, images manquantes, polices chargées ;
  - ajustement automatique des textes à leur cadre ;
  - correction automatique en jusqu'à 3 passes.
- **Gabarits** : orientés **kits pour enfants** (énigmes, idées, guides, recettes, sciences, coloriage). ✅ pour La Malle à Jeux, 🟡 pour l'édition premium.
- **Ce qui manque pour UNWRITTEN** ❌ :
  - **Formats** : seuls A4 portrait, A4 paysage et carré 210 mm ; pas de A5 ni de 3:4.
  - **Mise en forme du texte** : pas de flux de texte multi-pages avec gestion des veuves et orphelines, pas de césure.
  - **Gabarits éditoriaux absents** : faux-titre, dédicace, ouverture de chapitre, citation, double page.
  - **Polices** : uniquement des polices « enfant » (Nunito, Fredoka, Baloo).

### 2.8 Stockage
- Abstraction `StorageDriver` : local (développement) ou S3 compatible (Cloudflare R2 en production).
- Deux espaces : `public/` et `private/` (fichiers payants servis uniquement par liens signés).
- Envoi des gros fichiers par morceaux (limite Vercel de 4,5 Mo par requête) ou par URL présignée.
- Images déclinées (vignette, écran, numérique) et mises en cache. ✅

### 2.9 Traitements asynchrones
- pg-boss : génération, illustrations, PDF, vidéos, publication, pilote automatique en étapes reprenables, budget par livre, pause et annulation. ✅
- Le worker tourne sur Hetzner, jamais dans une requête HTTP Vercel. ✅
- Limite : serveur de 1 Go de RAM, une génération à la fois ; tolérable pour La Malle à Jeux, **insuffisant pour des milliers de livres** (voir § 6). 🟡

### 2.10 Paiements
- **Stripe Checkout**, webhooks vérifiés et **idempotents** (`StripeEvent`), commande en attente puis payée uniquement par webhook. ✅
- Codes promo synchronisés avec Stripe, remboursements total et partiel, factures numérotées, TVA incluse. ✅
- **Devise unique EUR** (champ `currency` présent, non exploité). 🟡

### 2.11 Livraison
- **Droits de téléchargement** (`DownloadEntitlement`) : jeton, quota, expiration, révocation au remboursement.
- **Liens** : liens signés temporaires, e-mail de confirmation (Resend), page « Mes achats ».
- **Publication tardive** : e-mail automatique quand un fichier est ajouté après coup. ✅
- **Ce qui manque** ❌ : la **livraison d'un livre généré par commande** (produit personnalisé). Aujourd'hui, un produit = un PDF commun à tous les acheteurs.

### 2.12 Traduction et internationalisation
- **Aucune.**
  - Interfaces en français codé en dur.
  - `<html lang="fr">`, aucune route localisée, aucun `hreflang`.
  - Le réglage `language` du studio existe (« fr ») mais n'est pas exploité par les prompts. ❌

### 2.13 Gestion des erreurs
- **Tâches** : échecs enregistrés avec leur cause (affichés dans « Tâches »), reprise étape par étape, journal du worker.
- **Messages précis** :
  - refus de la boutique détaillés par champ ;
  - pages fautives indiquées en cas de débordement.
- **Audit** : journal d'audit dans l'admin boutique. ✅
- **Ce qui manque** ❌ :
  - **Surveillance et alertes** : rien de centralisé (pas de Sentry ou équivalent, pas d'alerte sur le worker).
  - **Limitation du débit** : seulement sur 3 actions publiques.

### 2.14 Coûts techniques estimables
- `GenerationLog` enregistre **pour chaque appel IA** : modèle, jetons d'entrée et de sortie, images, coût, durée, succès. Coût cumulé par livre affiché dans le studio, budget maximal par livre, estimation avant lancement. ✅
- **Limite importante** : les coûts sont calculés à partir d'une **table de tarifs codée** (`lib/ai/pricing.ts`), pas des factures.
  - **Claude** : les tarifs de la table (Opus 5.5 4 $ / 20 $, Sonnet 5.5 2 $ / 10 $, Haiku 5.5 0,10 $ / 0,50 $ par million de jetons) **correspondent aux tarifs publics d'Anthropic** au 3 novembre 2026.
  - **OpenAI** : les tarifs des images (`gpt-image-1` 0,011 $ / 0,042 $ / 0,167 $ selon la qualité, `gpt-image-1-mini` 0,005 $ / 0,011 $ / 0,036 $) sont marqués « estimations » dans le code et **non vérifiés** dans cet audit.
  - **Stockage, calcul et frais Stripe** ne sont pas suivis par livre. 🟡

### 2.15 Composants réutilisables
| Composant | Où | Réutilisable pour UNWRITTEN |
|---|---|---|
| Univers multi-domaines (`Site`, réglages par univers, thème, résolution par nom d'hôte, sélecteur d'univers dans l'admin) | boutique | **Oui** : base de l'architecture multimarque |
| Panier, Stripe Checkout, webhooks, factures, remboursements, codes promo | boutique | Oui (à étendre aux devises et aux produits personnalisés) |
| Droits de téléchargement, liens signés, e-mails | boutique | Oui |
| Admin produits, collections, catégories, pages, blog, SEO de base, sitemap, avis réels | boutique | Oui |
| Marketing (campagnes, posts, rentabilité par produit, Meta / TikTok / Etsy) | boutique | Oui |
| Créatrices (commissions, paiements) | boutique | Oui, modèle de l'affiliation |
| Pilote automatique (brief → plan → rédaction → illustrations → PDF → boutique → vidéos → publicités) | studio | **Oui** : socle du moteur, à étendre aux commandes |
| Sortie structurée fiable, mode copier-coller, budget par livre, journal des coûts | studio | Oui |
| Composition en blocs + PDF Chromium + contrôles | studio | Oui, à enrichir fortement (§ 5) |
| Stockage R2, déclinaisons d'images, cadrage | studio | Oui |
| Vidéos promotionnelles (Remotion, Runway) | packages/video | Oui |

---

## 3. Fonctionnalités : réutiliser, améliorer, créer

### Réutilisables telles quelles
Paiement Stripe et webhooks idempotents, droits de téléchargement, liens signés, e-mails transactionnels, stockage privé, file de tâches, journal des coûts IA, sortie structurée, admin et rôles, marketing, vidéos, créatrices (pour l'affiliation).

### À améliorer
1. **Univers → marques** : ajouter devises, langues, e-mails et identité par marque ; isoler strictement les commandes et statistiques.
2. **Moteur PDF** : formats A5 et 3:4, flux de texte paginé, gabarits éditoriaux, typographie premium, bible visuelle, contrôle qualité étendu (pages vides, espaces vides, contraste, QR codes, personnalisation).
3. **Échelonnement des modèles IA par tâche** (Haiku pour extraire et classer, Sonnet ou Opus pour écrire).
4. **Suivi des coûts** : ajouter Stripe, stockage, traitement, tentatives ; coût par commande et par collection.
5. **Studio** : comptes individuels et rôles (aujourd'hui un mot de passe partagé).
6. **Surveillance et alertes**, CI pour le studio.

### À créer
1. **Produit personnalisé à la commande** : questionnaire dynamique, sauvegarde et reprise, aperçu partiel avant paiement, génération déclenchée par le paiement, contrôle qualité bloquant, livraison individuelle.
2. **Bibliothèque client** (compte léger par lien magique), option **cadeau** (le destinataire complète ses informations), corrections avant génération définitive.
3. **Internationalisation** : routes localisées, `hreflang`, devises, contenus marketing adaptés, livres rédigés directement dans la langue.
4. **QR codes et contenus débloquables**, sauvegarde de l'avancement (The Secret Book).
5. **Photos et souvenirs client** (The Movie of My Life) : envoi, chiffrement, durée de conservation, suppression, distinction « fait documenté » / « souvenir non vérifié ».
6. **Vitrine UNWRITTEN** : identité premium, pages collections, intentions d'achat SEO.
7. **Tableau de bord économique** : marge contributive par commande.
8. **RGPD renforcé** : registre, consentements, export et suppression des données, durées de conservation.

---

## 4. Économie unitaire : ce qu'on peut affirmer aujourd'hui

**Coûts constatés (journal du studio, tarifs du code) sur des livres réels de La Malle à Jeux :**
- **Rédaction** d'un petit kit de 12 pages avec Opus 5.5 : **≈ 0,48 $**, soit 3 min 12 s.
- **Esquisses** : 16 images pour **0,12 $**, avec une version finale estimée à 3,84 $ par le studio.

Ce sont des mesures du journal, calculées avec les tarifs du code : elles ne remplacent pas une facture.

**Leviers vérifiés dans la documentation Anthropic** :
- **API Batch** : −50 % sur des traitements asynchrones. Les commandes UNWRITTEN tolèrent plusieurs minutes d'attente : c'est le levier le plus simple.
- **Mise en cache des consignes** : lecture du cache à 0,20 $ par million de jetons sur Opus 5.5, contre 4 $ en entrée standard.
- **Haiku 5.5** (0,10 $ / 0,50 $) pour les tâches simples : 40 fois moins cher que Opus en sortie.
- **Réflexion du modèle** : elle compte en jetons de sortie. Son coût réel n'est connu qu'en mesurant ; l'effort `medium` ou `low` sur les tâches simples la réduit.

Les estimations par collection sont dans `ARCHITECTURE_UNWRITTEN.md` § 7. Elles reposent sur des hypothèses explicites et seront remplacées par des mesures dès les trois livres de démonstration.

---

## 5. Risques techniques

| # | Risque | Gravité | Atténuation proposée |
|---|---|---|---|
| R1 | Perturber La Malle à Jeux en modifiant la boutique partagée | Élevée | Marque isolée par `brandId`, arbre de routes séparé, tests de non-régression, préproduction obligatoire |
| R2 | Worker sous-dimensionné (1 Go, 20 Go, une tâche à la fois) | Élevée dès quelques commandes par jour | Serveur 4 à 8 Go, plusieurs workers, file par priorité (commandes payées avant le marketing) |
| R3 | Qualité éditoriale insuffisante (gabarits enfants, pas de flux paginé) | Élevée pour un prix premium | Nouveau moteur éditorial (§ 5 de l'architecture), relecture humaine des 3 premiers livres de chaque collection |
| R4 | Incohérence des personnages et illustrations | Moyenne | Bible visuelle par livre, références, nombre d'illustrations maîtrisé, contrôle par un modèle de vision |
| R5 | Données sensibles (souvenirs, photos, enfants, tiers) | Élevée (RGPD) | Minimisation, chiffrement, conservation limitée, suppression, conditions des fournisseurs IA à vérifier |
| R6 | Coûts IA dérivant (réflexion, régénérations) | Moyenne | Budget par commande bloquant, profils ECO, STANDARD et PREMIUM, API Batch, mise en cache, alertes |
| R7 | Pas d'i18n : chantier transversal | Moyenne | Limité à la vitrine UNWRITTEN (l'admin reste en français) |
| R8 | Vercel Hobby : crons quotidiens, durée des fonctions | Moyenne | Passage en offre Pro avant lancement, tout le long reste dans le worker |
| R9 | Pas de surveillance ni d'alertes | Moyenne | Sentry ou équivalent, alerte sur file bloquée et taux d'échec |
| R10 | Dépendance à OpenAI pour les images (modèle `gpt-image-1` indisponible sur le compte au 11/11) | Moyenne | Repli déjà en place ; vérification d'organisation OpenAI ; abstraction prête pour un second fournisseur |

## 6. Infrastructure : coûts fixes

Je n'annonce pas de montants que je n'ai pas vérifiés. Voici les postes et ce qui est connu.

| Poste | Situation actuelle | Pour UNWRITTEN |
|---|---|---|
| Vercel | Offre Hobby (gratuite) | **Pro recommandé** (crons fréquents, limites, usage commercial) : tarif à vérifier sur vercel.com |
| Neon (PostgreSQL) | En service | Offre selon volume : à vérifier |
| Cloudflare R2 | 10 Go gratuits (offre gratuite) | Quelques Go par millier de livres ; photos clients en plus |
| Hetzner (worker) | Serveur 1 Go, environ 4 € par mois annoncé lors de l'installation (CX22 envisagé) | 1 à 2 serveurs de 4 à 8 Go : tarifs à vérifier sur hetzner.com |
| Resend (e-mails) | Domaine `lamalleajeux.eu` à valider | Domaine UNWRITTEN à ajouter |
| Stripe | Commission par paiement (tarifs Stripe à vérifier selon pays et carte) | Comptes par marque ou un compte unique (décision juridique) |
| Surveillance | Aucune | Offre gratuite d'un service d'erreurs au départ |

## 7. Dépendances principales

- **Payantes à l'usage** : Anthropic, OpenAI, Runway (vidéos), Stripe, Resend.
- **Hébergement** : Vercel, Neon, Cloudflare R2, Hetzner.
- **Bibliothèques clés** : Next.js 15 et 16, Prisma 6, Auth.js 5 (bêta), pg-boss 12, Playwright Core 1.65, pdf-lib, sharp, Remotion 4, Zod 3 et 4 (selon l'application).
- **Point d'attention** : Auth.js 5 est en version bêta, et le studio et la boutique ont des versions de Next.js et de Zod différentes. Un alignement est souhaitable mais pas urgent.

## 8. Décisions d'architecture recommandées (détail dans ARCHITECTURE_UNWRITTEN.md)

1. **Le studio devient le moteur commun** de toutes les marques, sans réécriture : on étend le pilote automatique à un nouveau type de production, le **livre personnalisé par commande**.
2. **La boutique devient multimarque** en étendant le modèle `Site` existant (marque = univers enrichi). Proposition : la vitrine UNWRITTEN est un **arbre de routes séparé** dans la même application, pour réutiliser paiements, commandes et administration sans toucher aux pages de La Malle à Jeux. Une application distincte reste possible ; c'est un arbitrage à faire (voir § 10 de l'architecture).
3. **Nouveau moteur éditorial** dans le studio : formats, flux paginé, gabarits, polices sous licence libre, bible visuelle, contrôle qualité bloquant.
4. **Économie mesurée** : coût par commande (IA, images, Stripe, stockage, tentatives), profils ECO, STANDARD et PREMIUM, échelonnement des modèles, API Batch.
5. **Préproduction obligatoire** : environnement de préversion Vercel et base séparée.
