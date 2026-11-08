# API d'importation (v1)

Base : `https://<votre-domaine>/api/v1` — toutes les réponses sont en JSON : `{ "data": … }` en succès, `{ "error": "…", "details": … }` en erreur.

## Authentification

Créez une clé dans **Administration → API & automatisation**. Elle n'est affichée qu'une fois ; seule son empreinte SHA-256 est stockée.

```
Authorization: Bearer cc_xxxxxxxx…
```

Scopes :

| Scope | Permet |
|---|---|
| `products:read` | lire le catalogue, les catégories et collections, les statistiques de ventes (implicite pour une clé `products:write` ou `products:publish`) |
| `products:write` | créer / modifier des produits **en brouillon**, ajouter images et fichiers, programmer une publication |
| `products:publish` | publier immédiatement sans validation humaine (à réserver à des intégrations de confiance) |

Limite : 60 requêtes par minute et par clé (`429` au-delà). Clé révoquée ou inconnue → `401`. Scope manquant → `403`.

## Validation humaine

Tout produit créé par l'API est un **brouillon** avec `needsReview = true`. Il apparaît dans la file « Produits en attente de validation humaine » de l'administration. Un éditeur le vérifie puis le publie. Une clé sans `products:publish` peut seulement **programmer** une publication (`scheduledAt`), ce qui laisse le temps d'une relecture.

## Routes

### `POST /products` — créer un brouillon

Corps JSON (champs principaux ; tous ceux du formulaire produit sont acceptés) :

```json
{
  "name": "Chasse au trésor des dinosaures",
  "slug": "chasse-au-tresor-dinosaures",
  "tagline": "Une aventure préhistorique à imprimer",
  "shortDescription": "…",
  "longDescription": "markdown…",
  "story": "markdown…",
  "template": "ADVENTURE",
  "categorySlug": "chasses-au-tresor",
  "collectionSlugs": ["5-8-ans"],
  "universe": "Dinosaures",
  "tags": ["dinosaures", "chasse au trésor"],
  "badges": ["Nouveau"],
  "heroBadges": ["PDF immédiat", "Prêt à imprimer"],
  "ageMin": 5, "ageMax": 8, "playersMin": 2, "playersMax": 8,
  "durationMinutes": 60, "difficulty": 2, "pageCount": 24, "materials": ["imprimante", "ciseaux"],
  "priceCents": 990, "salePriceCents": 790, "saleEndsAt": "2026-12-31T23:59:00Z", "currency": "EUR", "taxRateBp": 2000,
  "kitContents": [{ "title": "Carte au trésor", "description": "…", "icon": "map", "quantity": 1 }],
  "faq": [{ "question": "…", "answer": "…" }],
  "sellingPoints": [{ "title": "…", "description": "…", "icon": "sparkles" }],
  "seoTitle": "…", "seoDescription": "…", "keywords": ["…"], "promoText": "…",
  "recommendedProductIds": [],
  "images": [{ "url": "https://…/cover.png", "role": "MAIN", "alt": "…" }]
}
```

Templates : `ADVENTURE`, `ACTIVITY`, `STORY`, `EVENT`, `CLASSIC`. Rôles d'image : `MAIN`, `GALLERY`, `ILLUSTRATION`, `MOCKUP`, `PDF_PREVIEW`, `VIDEO` (URL), `OG`.

Réponse `201` : le produit complet, avec `editUrl` (lien d'édition dans l'administration) et `publicUrl` (null tant qu'il n'est pas publié). Les images dont le téléchargement a échoué sont listées dans `warnings`.

### `GET /products?page=1&perPage=25&status=PUBLISHED&slug=…&source=api`

`status` : `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED` ou `all` (défaut : tous). `perPage` ≤ 100. Chaque produit inclut `salesCount`. Réponse paginée : `{ data, page, perPage, total }`.

Filtres facultatifs : `status`, `slug` (recherche exacte, utile pour retrouver un produit créé par une intégration), `source` (`admin`, `csv`, `api`, `duplicate`).

### `GET /products/:id` (id ou slug)

### `GET /products/:id/stats` — ventes du produit

Réponse : `{ productId, currency, total: { orders, units, revenueCents, revenueNetCents, refundedCents }, last30Days: { … }, lastOrderAt }`. Revenus TTC remboursements déduits (au prorata de la commande) et HT ; commandes payées ou remboursées uniquement ; les ventes via un pack ne sont pas ventilées.

### `PATCH /products/:id` — mise à jour partielle

Envoyez uniquement les champs à modifier. Le statut ne change pas via PATCH (sauf retour à `DRAFT` ou `ARCHIVED`) : utilisez `/publish`.

### `POST /products/:id/images`

- multipart/form-data : `file` (image), `role`, `alt`, `replace` (`1` pour supprimer d'abord les images existantes du même rôle)
- ou JSON : `{ "url": "https://…", "role": "GALLERY", "alt": "…", "replace": true }`

### `POST /products/:id/files`

multipart/form-data : `file` (PDF ou ZIP, 100 Mo max), `kind` (`MAIN_PDF`, `EXTRA_PDF`, `INSTRUCTIONS`, `BONUS`), `name`, `description`, `replace` (`1` pour remplacer les fichiers existants du même type : re-synchronisation idempotente depuis un outil de création). Le fichier est stocké dans l'espace **privé** : il n'a jamais d'URL publique et n'est livré qu'après paiement.

### `POST /products/:id/publish`

- `{ "scheduledAt": "2026-12-01T08:00:00Z" }` → statut `SCHEDULED` (publication par la tâche planifiée `/api/cron/publish`).
- `{}` → publication immédiate, **uniquement** avec le scope `products:publish` (sinon `403`).
- `409` si aucun fichier numérique n'est attaché.

### `GET /categories`, `GET /collections`

## Flux recommandé pour un agent IA

1. `POST /products` avec textes, prix, SEO, catégorie → brouillon.
2. `POST /products/:id/images` pour la couverture (`MAIN`), la galerie et les aperçus.
3. `POST /products/:id/files` pour le PDF payant.
4. `POST /products/:id/publish` avec `scheduledAt`, ou laisser un humain publier depuis l'administration.

## Tâches planifiées

| Route | Fréquence (vercel.json) | Rôle |
|---|---|---|
| `GET /api/cron/publish` | toutes les 15 min | publie les produits et articles programmés |
| `GET /api/cron/marketing` | toutes les heures | relances de paniers abandonnés (avec consentement), annonces de nouveautés aux abonnés |

Les routes cron acceptent le header `x-vercel-cron` (Vercel) ou `Authorization: Bearer <CRON_SECRET>`.
