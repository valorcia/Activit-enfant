# Boutique — La Malle à Jeux

Plateforme e-commerce premium pour vendre des produits numériques destinés aux enfants de 3 à 10 ans : chasses au trésor, cahiers d'activités, kits d'événements, histoires illustrées. Site vitrine, boutique, landing page automatique par produit, back-office complet, paiement Stripe Checkout et livraison numérique sécurisée.

## Pile technique

| Couche | Choix |
|---|---|
| Interface | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, composants Radix (style shadcn/ui), Framer Motion |
| Données | PostgreSQL + Prisma 6 (montants en centimes, contenus structurés JSON validés par Zod) |
| Authentification | Auth.js v5 (identifiants + JWT), rôles ADMIN / EDITOR / MARKETING / SUPPORT |
| Paiement | Stripe Checkout (CB, Apple Pay, Google Pay, codes promo), webhooks signés et idempotents, remboursements |
| Stockage | Objet privé compatible S3 (AWS, R2, Scaleway, MinIO) avec URLs signées ; disque local en développement |
| Emails | Resend (ou console en développement) |
| Hébergement | Vercel (ISR + revalidation par tags, crons) |

## Installation locale

Prérequis : Node 20+, pnpm 10, PostgreSQL 14+.

```bash
# depuis la racine du monorepo
pnpm install
cd apps/shop
cp .env.example .env          # renseigner DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD…
pnpm db:migrate               # crée le schéma
pnpm db:seed                  # admin, catégories, collections, pages juridiques (brouillons), premier produit
pnpm dev                      # http://localhost:3000 — admin : http://localhost:3000/admin
```

`SEED_DEMO=1 pnpm db:seed` ajoute cinq produits d'exemple **en brouillon** (clairement nommés « (Exemple) ») pour visualiser les modèles de fiche.

### Stripe en mode test

1. Renseigner `STRIPE_SECRET_KEY` (sk_test_…), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_…).
2. Lancer l'écoute des webhooks en local :
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   puis copier le `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
3. Carte de test : `4242 4242 4242 4242`.

Événements écoutés : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`.

### Scripts

| Commande | Rôle |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Serveur Next.js |
| `pnpm db:migrate` / `pnpm db:deploy` | Migrations Prisma (dev / production) |
| `pnpm db:seed` | Données initiales |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm test` | Tests unitaires et d'intégration (base `shop_test`) |

## Architecture

```
prisma/                      schéma, migrations, seed
src/app/(storefront)/        vitrine : accueil, boutique, catégories, collections, packs, aventures/[slug] (landing page produit),
                             panier, commande (confirmation, accès, facture), mes-achats, newsletter, blog, pages
src/app/admin/               back-office : tableau de bord, produits, catégories, collections, packs, import,
                             commandes, clients, avis, codes promo, newsletter, blog, apparence, pages, paramètres,
                             utilisateurs, API
src/app/api/                 stripe/webhook, download, media, storage/local, admin/*, v1/* (API d'importation), cron/*
src/app/actions/             server actions (checkout, newsletter, avis, admin/*)
src/lib/                     db, env, auth, settings, pricing, catalog, orders (checkout, fulfillment, access, notify),
                             storage (local, s3), email, marketing, products (service), import, api
src/components/ui/           design system (boutons, badges, cartes, dialogues, onglets…)
src/components/storefront/   composants de la vitrine (header, footer, panier, carte produit…)
src/components/product/      sections et modèles de la fiche produit
src/components/admin/        composants du back-office
tests/                       vitest (prix, jetons, permissions, livraison, téléchargements, API, protection admin)
```

### Flux d'achat et livraison

1. Le panier (client, localStorage) envoie uniquement des identifiants et quantités.
2. `createCheckoutSession` recalcule les prix depuis la base, crée une commande `PENDING` et une session Stripe Checkout (prix TTC, `tax_behavior: inclusive`, factures Stripe activées, consentement aux CGV et mention de renonciation au droit de rétractation).
3. Le webhook Stripe (signature vérifiée, événement enregistré dans `StripeEvent` pour l'idempotence) marque la commande `PAID`, crée le client, un `DownloadEntitlement` par produit (packs décomposés), incrémente les ventes, puis envoie l'email de confirmation avec un lien d'accès signé.
4. La page de confirmation n'effectue jamais la livraison : elle affiche l'état de la commande et se rafraîchit jusqu'à la confirmation serveur.
5. Les téléchargements passent par `/api/download/[token]/[fileId]` : vérification du droit (révocation, expiration, quota), journalisation, puis redirection vers une URL signée de 5 minutes. Les fichiers payants n'ont jamais d'URL publique.
6. « Retrouver mes achats » envoie un lien magique (`AccessLink`) par email ; aucun compte client n'est requis.

### Cache et performance

Les pages publiques sont statiques/ISR (`revalidate = 300`) et invalidées par tags (`catalog`, `product:<slug>`, `site-settings`, `pages`, `blog`, `reviews`) à chaque modification dans l'admin. Les images passent par `next/image` (AVIF/WebP).

### Rôles

| Permission | ADMIN | EDITOR | MARKETING | SUPPORT |
|---|---|---|---|---|
| Produits, catégories, packs, import | ✓ | ✓ | lecture | lecture |
| Commandes, remboursements | ✓ | – | lecture | ✓ |
| Avis, codes promo, newsletter, blog | ✓ | blog | ✓ | avis |
| Apparence | ✓ | – | ✓ | – |
| Paramètres, utilisateurs, clés API | ✓ | – | – | – |

## Déploiement sur Vercel

1. Importer le dépôt, **Root Directory = `apps/shop`**, framework Next.js, commande de build `pnpm build` (exécute `prisma generate`).
2. Base PostgreSQL managée (Neon via l'onglet Storage de Vercel, Supabase…) : `DATABASE_URL` et `DATABASE_URL_UNPOOLED` (connexion directe pour les migrations). Commande de build Vercel : `pnpm build:vercel` (migrations + seed idempotent + build) avec `ADMIN_EMAIL` / `ADMIN_PASSWORD` définis.
3. Variables d'environnement (voir `.env.example`) : `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET`, `STRIPE_*`, `STORAGE_DRIVER=s3` + `S3_*`, `EMAIL_DRIVER=resend` + `RESEND_API_KEY` + `EMAIL_FROM`, `DOWNLOAD_TOKEN_SECRET`, `CRON_SECRET`.
4. Webhook Stripe (dashboard → Developers → Webhooks) : `https://<domaine>/api/stripe/webhook` avec les événements listés ci-dessus ; copier le secret dans `STRIPE_WEBHOOK_SECRET`.
5. Crons (`vercel.json`) : `/api/cron/publish` (publications programmées) et `/api/cron/marketing` (paniers abandonnés, nouveautés).
6. Prévoir deux projets/environnements Vercel (Preview = Stripe test, Production = Stripe live) et activer les sauvegardes de la base chez l'hébergeur.

## Sécurité et conformité

- Secrets uniquement côté serveur ; aucune donnée de carte ne transite par l'application.
- Routes `/admin` et `/api/admin` protégées par `src/proxy.ts` + vérification des rôles dans chaque page/action.
- Prix validés serveur, webhooks idempotents, droits de téléchargement révocables, quotas et journal des téléchargements.
- Avis clients soumis à modération ; jamais de faux avis.
- Consentements marketing tracés (`MarketingConsent`), double opt-in newsletter, bannière cookies avec chargement conditionnel des pixels.
- Pages juridiques (mentions légales, CGV, confidentialité, cookies, rétractation) créées en **brouillon** : à rédiger et valider avant mise en production.
- Les commandes historiques sont conservées lorsqu'un produit est archivé (jamais de suppression d'un produit vendu).

## API d'importation

Voir `docs/API.md`. Un produit créé par l'API est enregistré en brouillon avec « validation humaine requise » ; il n'est publié qu'après revue dans l'admin (ou immédiatement si la clé possède le scope `products:publish`).
