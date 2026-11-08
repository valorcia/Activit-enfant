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
  "siteSlug": "la-malle-a-jeux",
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

`siteSlug` : univers (boutique) du produit, voir `GET /sites` ; absent = univers par défaut (La Malle à Jeux) ; inconnu = `422`. `categorySlug` et `collectionSlugs` sont résolus **dans cet univers** (deux univers peuvent avoir une catégorie `guides`).

Templates : `ADVENTURE`, `ACTIVITY`, `STORY`, `EVENT`, `CLASSIC`, `GUIDE` (guide pratique adulte), `RECIPES` (recettes). Rôles d'image : `MAIN`, `GALLERY`, `ILLUSTRATION`, `MOCKUP`, `PDF_PREVIEW`, `VIDEO` (URL), `OG`.

Réponse `201` : le produit complet, avec `site: { slug, name, url }`, `editUrl` (lien d'édition dans l'administration) et `publicUrl` (sur le domaine de l'univers, null tant qu'il n'est pas publié). Les images dont le téléchargement a échoué sont listées dans `warnings`.

### `GET /products?page=1&perPage=25&status=PUBLISHED&slug=…&source=api`

`status` : `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED` ou `all` (défaut : tous). `perPage` ≤ 100. Chaque produit inclut `salesCount`. Réponse paginée : `{ data, page, perPage, total }`.

Filtres facultatifs : `status`, `slug` (recherche exacte, utile pour retrouver un produit créé par une intégration), `source` (`admin`, `csv`, `api`, `duplicate`), `site` (slug d'univers).

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

### `POST /products/:id/marketing/autopilot` — campagne et publications automatiques

Scope `products:write`. Crée **une** campagne tracée (`utm_campaign` unique) et les publications du produit pour chaque canal demandé. Les textes sont générés par Claude (clé dans Paramètres → Intégrations) ou fournis dans `copy` (mode copier-coller du studio).

```json
{
  "channels": ["instagram", "facebook", "tiktok"],
  "variantsPerChannel": 2,
  "videoUrls": ["https://…/pub-story.mp4"],
  "copy": null,
  "campaign": { "name": "Lancement dinosaures", "dailyBudgetCents": 500, "startsAt": "2026-12-01T09:00:00Z", "objective": "conversions" },
  "schedule": { "mode": "draft", "startAt": null, "spacingHours": 24 }
}
```

- `channels` : au moins un parmi `instagram`, `facebook`, `tiktok`. `variantsPerChannel` : 1 à 3 (défaut 2).
- `videoUrls` : facultatif. Sinon, la vidéo la plus récente du produit par format (`ProductImage` VIDEO). La vidéo **story** (9:16) va aux Reels Instagram et à TikTok ; Facebook reste en image + lien.
- `copy` : JSON du copywriter `{"variants":[{"channel","label","hook","body","cta","headline","hashtags","imageIndex"}]}`. Fourni → aucun appel IA.
- `schedule.mode` : `draft` (défaut, validation humaine dans Admin → Marketing social → Autopilote) ou `auto` : les posts dont le canal a un compte connecté passent en `SCHEDULED` à `startAt` (défaut : maintenant + 1 h) puis tous les `spacingHours`. Les autres restent en brouillon. Produit non publié → tout reste en brouillon.
- Campagne : `Campaign.source = "api"`, `channel` = `META` (Instagram/Facebook seuls), `TIKTOK` (TikTok seul) ou `OTHER` (mixte). Chaque post a son lien `utm_source=<canal>&utm_content=<id du post>`.

Réponse `201` :
```json
{ "data": { "campaignId": "…", "campaignSlug": "lancement-dinosaures", "landingUrl": "https://…/aventures/…?utm_source=instagram&utm_medium=paid&utm_campaign=lancement-dinosaures",
  "adminUrl": "https://…/admin/marketing/campagnes/…", "generatedBy": "api",
  "posts": [ { "id": "…", "channel": "instagram", "format": "REEL_COVER", "status": "DRAFT", "scheduledAt": null, "accountName": null } ] } }
```

Erreurs :
- `409` `{"error":"copywriter_unavailable","details":{"prompt":"…","schema":"…"}}` : aucune clé Claude et pas de `copy`. Faites coller `prompt` dans Claude/ChatGPT puis renvoyez la réponse dans `copy`.
- `422` : corps invalide, ou `copy` ne respectant pas le schéma (`details.issues`).
- `404` produit inconnu, `403` scope manquant.

### `GET /products/:id/marketing` — campagnes du produit

Scope `products:read`. `{"data":{"campaigns":[{"id","slug","name","status","source","channel","landingUrl","posts":[{"id","provider","format","status","label","hook","linkUrl","videoUrl","scheduledAt","publishedAt","externalUrl","accountName","error"}],"stats":{"orders","revenueCents","revenueHtCents","spendCents","roas"}}]}}` (statistiques sur toute la période, ventes attribuées par `utm_campaign`).

### `GET /categories?site=…`, `GET /collections?site=…`

Chaque ligne indique son univers (`site.slug`) ; `site` filtre sur un univers.

### `GET /sites` — univers disponibles

Toute clé valide (lecture seule). Univers non archivés, univers par défaut en premier :

```json
{ "data": [{
  "id": "…", "slug": "fini-l-eau-verte", "name": "Fini l'eau verte", "preset": "guide-expert", "status": "TEST", "isDefault": false,
  "audience": { "slug": "maison-jardin", "name": "Maison & jardin" },
  "primaryDomain": "finileauverte.fr", "url": "https://finileauverte.fr",
  "categories": [{ "slug": "guides-pratiques", "name": "Guides pratiques" }]
}] }
```

`url` est l'adresse publique (domaine principal, sinon l'URL de l'application). Un univers `TEST` est servi (sur ses domaines et en aperçu `/?site=slug`) mais jamais indexé par les moteurs : ses produits peuvent être créés et publiés pour relecture avant le passage en `ACTIVE`.

### `PATCH /products/:id` avec `siteSlug`

Déplace le produit dans un autre univers. Sans `categorySlug`, la catégorie et les collections sont retirées (elles appartiennent à l'ancien univers).

## Flux recommandé pour un agent IA

0. `GET /sites` pour choisir l'univers (`siteSlug`) et ses catégories.
1. `POST /products` avec `siteSlug`, textes, prix, SEO, catégorie → brouillon.
2. `POST /products/:id/images` pour la couverture (`MAIN`), la galerie et les aperçus.
3. `POST /products/:id/files` pour le PDF payant.
4. `POST /products/:id/publish` avec `scheduledAt`, ou laisser un humain publier depuis l'administration.

## Tâches planifiées

| Route | Fréquence (vercel.json) | Rôle |
|---|---|---|
| `GET /api/cron/publish` | toutes les 15 min | publie les produits et articles programmés |
| `GET /api/cron/marketing` | toutes les heures | relances de paniers abandonnés (avec consentement), annonces de nouveautés aux abonnés |

Les routes cron acceptent le header `x-vercel-cron` (Vercel) ou `Authorization: Bearer <CRON_SECRET>`.
