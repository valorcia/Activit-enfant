# Mise en route complète — ce qu'il reste à configurer pour une plateforme 100 % automatique

Cochez dans l'ordre. Chaque phase est utilisable seule : la phase 1 permet de vendre, la phase 2 de produire en automatique, la phase 3 de faire la publicité, la phase 4 d'ouvrir d'autres univers.

Légende :
- **[Vous]** : action dans un service externe, qui ne peut pas se faire par API ;
- **[Admin]** : saisie dans l'admin de la boutique (`https://activite-enfant-shop.vercel.app/admin`) ;
- **[Studio]** : saisie dans les paramètres du studio ;
- **[Vercel]** : variable d'environnement du projet Vercel, puis *Redeploy*.

---

## Phase 1 — Boutique opérationnelle (vendre et livrer)

### 1.1 Vercel, projet `activite-enfant-shop`
- [ ] **[Vercel]** Variables présentes : `AUTH_SECRET`, `DOWNLOAD_TOKEN_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (injectées par Neon).
- [ ] **[Vercel]** `NEXT_PUBLIC_APP_URL` = l'adresse publique de la boutique (ex. `https://activite-enfant-shop.vercel.app`, puis votre domaine).
- [ ] **[Vercel]** Settings → General → Node.js Version : **22.x**. Settings → Functions → Region : **London (lhr1)**, la plus proche de la base Neon.
- [ ] **[Vous]** Recommandé : une base Neon **dédiée** à la boutique, au lieu de la base partagée actuelle (Storage → Create Database → Neon, puis la connecter au projet).

### 1.2 Stockage des fichiers (obligatoire en ligne)
Sans stockage S3, les PDF et images envoyés par le studio ou l'admin **disparaissent** à chaque déploiement.
- [ ] **[Vous]** Créer un compte Cloudflare (gratuit), puis R2 → *Create bucket* `malle-a-jeux-boutique` (privé). Créer aussi `malle-a-jeux-studio` pour le studio.
- [ ] **[Vous]** R2 → *Manage API tokens* → jeton « Object Read & Write » sur les deux buckets. Noter : Access Key ID, Secret Access Key, endpoint `https://<id-compte>.r2.cloudflarestorage.com`.
- [ ] **[Vercel]** `STORAGE_DRIVER=s3`, `S3_BUCKET=malle-a-jeux-boutique`, `S3_REGION=auto`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- [ ] **[Vous]** Pour servir les images rapidement : R2 → bucket → *Settings* → *Public access* via un sous-domaine personnalisé (ex. `media.lamalleajeux.fr`), puis **[Vercel]** `S3_PUBLIC_BASE_URL=https://media.lamalleajeux.fr`. Seul le dossier `public/` des images y est exposé ; les PDF restent privés et ne sont servis que par des liens signés.

### 1.3 Paiement Stripe
- [ ] **[Vous]** Compte Stripe activé : informations de l'entreprise, IBAN, pièce d'identité, nom affiché sur les relevés.
- [ ] **[Vous]** Stripe → Paramètres → Paiements : activer Apple Pay et Google Pay (domaine vérifié automatiquement par Stripe Checkout).
- [ ] **[Vous]** Stripe → Développeurs → Webhooks → *Ajouter un endpoint* : `https://<votre-boutique>/api/stripe/webhook`, avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`. Copier le secret `whsec_…`.
- [ ] **[Admin]** Paramètres → Intégrations → Stripe : clé secrète (`sk_test_…` pour tester, puis `sk_live_…`), secret du webhook, clé publiable. Bouton **Tester**.
- [ ] Faire un achat test avec la carte `4242 4242 4242 4242` (en mode test), vérifier l'email et le téléchargement, puis passer en clés live et créer le webhook live.

### 1.4 Emails (confirmation de commande, accès aux achats, newsletter)
- [ ] **[Vous]** Compte Resend → *Domains* → ajouter votre domaine d'envoi (ex. `lamalleajeux.fr`), puis ajouter chez votre registrar les enregistrements DNS indiqués (SPF, DKIM).
- [ ] **[Vous]** Resend → *API Keys* → créer une clé.
- [ ] **[Admin]** Paramètres → Intégrations → Resend : coller la clé, **Tester**.
- [ ] **[Vercel]** `EMAIL_FROM="La Malle à Jeux <bonjour@lamalleajeux.fr>"` (adresse du domaine vérifié).

### 1.5 Contenus et mentions légales
- [ ] **[Admin]** Apparence → Marque : raison sociale, adresse, n° de TVA, email de contact (ils apparaissent sur les factures et dans les emails).
- [ ] **[Admin]** Pages : rédiger, faire valider puis **publier** les pages Mentions légales, CGV, Confidentialité, Cookies, Droit de rétractation. Elles sont en brouillon aujourd'hui.
- [ ] **[Admin]** Produits → Le trésor de la Capitaine Coquelicot : confirmer le prix (9,90 € provisoire) et téléverser le **vrai PDF** (onglet Fichiers), puis supprimer le fichier de test.
- [ ] Me renvoyer les 7 visuels de présentation du kit Coquelicot (galerie de la fiche).

---

## Phase 2 — Production automatique des e-books (studio + pilote automatique)

### 2.1 Clés d'IA
- [ ] **[Vous]** Anthropic : console.anthropic.com → *Billing* (ajouter du crédit) → *API Keys* → créer une clé. Elle sert à la rédaction des e-books et aux textes publicitaires.
- [ ] **[Vous]** OpenAI : platform.openai.com → *Billing* (crédit) → **Settings → Organization → Verify** (vérification d'identité **obligatoire** pour générer des images avec GPT Image) → *API keys* → créer une clé.
- [ ] **[Admin]** Paramètres → Intégrations : coller la clé Claude (textes publicitaires de la boutique), **Tester**.

### 2.2 Clé d'accès du studio à la boutique
- [ ] **[Admin]** API & automatisation → *Nouvelle clé* avec les droits `products:read`, `products:write`, `products:publish`. Copier la clé : elle ne s'affiche qu'une fois.

### 2.3 Déployer le studio sur Vercel
- [ ] **[Vous]** Vercel → *Add New Project* → dépôt `valorcia/Activit-enfant` → **Root Directory `apps/studio`** → nom `la-malle-a-jeux-studio`.
- [ ] **[Vous]** Onglet Storage : connecter la base Neon (les tables du studio vont dans le schéma `studio`, sans conflit).
- [ ] **[Vercel]** Variables du studio :
  - `STUDIO_PASSWORD` (mot de passe d'accès au studio, 8 caractères minimum) ;
  - `INTERNAL_TOKEN` (`openssl rand -hex 24`) ;
  - `DB_SCHEMA=studio` ;
  - `STORAGE_DRIVER=s3`, `S3_BUCKET=malle-a-jeux-studio`, `S3_REGION=auto`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` ;
  - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ;
  - `SHOP_API_URL=https://activite-enfant-shop.vercel.app`, `SHOP_API_KEY` (clé de 2.2) ;
  - `APP_URL` = adresse du studio une fois déployé.
- [ ] **[Vercel]** Node.js 22.x, région London (lhr1). Deploy, puis se connecter avec `STUDIO_PASSWORD`.

### 2.4 Le worker sur votre ordinateur
> **Vous avez un serveur (Hetzner ou autre) ?** Préférez-le : le worker y tourne en permanence, sans PC allumé. Procédure : `docs/WORKER-HETZNER.md`.

- [ ] **[Vous]** Installer Node.js 22 (nodejs.org) et pnpm (`npm install -g pnpm`), puis Git.
- [ ] Dans un terminal :
  ```bash
  git clone https://github.com/valorcia/Activit-enfant.git
  cd Activit-enfant
  pnpm install
  npx playwright install chromium
  cd apps/studio
  cp .env.production.example .env.production   # puis le remplir : mêmes valeurs que le studio Vercel + APP_URL
  pnpm worker:prod
  ```
- [ ] Laisser le terminal ouvert pendant la production d'un e-book. Pour mettre à jour plus tard : `git pull && pnpm install`.

### 2.5 Réglages du studio
- [ ] **[Studio]** Paramètres → Boutique : URL et clé (si non fournies par les variables), **Tester la connexion**.
- [ ] **[Studio]** Paramètres → IA : mode **API** pour le 100 % automatique (Claude pour le texte, GPT Image pour les images).
- [ ] **[Studio]** Paramètres → Studio : nom affiché, auteur, prix par type de kit, charte d'illustration.
- [ ] **[Studio]** Paramètres → Pilote automatique : publication directe ou brouillon, formats vidéo, canaux pub, programmation des posts, plafond de coût (10 $ par défaut), points de validation.
- [ ] **[Studio]** Page Boutique : importer « Le trésor de la Capitaine Coquelicot » pour le lier au studio.
- [ ] Premier essai : page Brief → coller le prompt de `docs/prompts/chasse-au-tresor-dinosaures.md` → **Tout lancer en automatique** → suivre la page Pilote automatique.

---

## Phase 3 — Publicité et vidéos

### 3.1 Vidéos Runway
- [ ] **[Vous]** Compte développeur sur dev.runwayml.com → acheter des crédits → créer une clé API.
- [ ] **[Studio]** Paramètres → Vidéo : clé Runway, coût par seconde, musique par défaut (fichier libre de droits).
- [ ] Essai : onglet « Vidéos pub » d'un livre → Story avec clip Runway de 5 s (≈ 0,25 $).

### 3.2 Meta (Facebook + Instagram)
- [ ] **[Vous]** business.facebook.com : créer le **Business Manager** (un seul pour tout).
- [ ] **[Vous]** Créer une **Page Facebook par audience** (Familles & enfants pour commencer) et la relier à un **compte Instagram professionnel**.
- [ ] **[Vous]** Créer un **compte publicitaire** par audience, avec un moyen de paiement.
- [ ] **[Vous]** Events Manager → créer un **pixel (jeu de données)** par audience → *Paramètres* → *API Conversions* → générer un **jeton d'accès**.
- [ ] **[Vous]** Paramètres de l'entreprise → *Sécurité de la marque* → *Domaines* : vérifier chaque domaine de vente (balise ou DNS).
- [ ] **[Vous]** developers.facebook.com → *Créer une app* (type Business) → ajouter « Facebook Login for Business », « Marketing API », « Instagram Graph API ». Dans Facebook Login → *URI de redirection OAuth valides* : `https://<boutique>/api/admin/social/meta/callback`. Demander en *App Review* les permissions `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `ads_read`, `ads_management`, `business_management`. Comptez quelques jours à quelques semaines.
- [ ] **[Admin]** Paramètres → Intégrations → Meta : App ID, App Secret, jeton API Conversions. **Tester**.
- [ ] **[Admin]** Paramètres → Analytics : ID du pixel Meta.
- [ ] **[Admin]** Marketing social → Connecteurs → **Connecter Meta**, puis rattacher chaque Page, compte Instagram et compte pub à son audience.

### 3.3 TikTok
- [ ] **[Vous]** TikTok for Business : créer un **Business Center**, un **compte publicitaire**, et un compte TikTok de marque par audience.
- [ ] **[Vous]** TikTok Events Manager : créer un **pixel** et générer un **jeton Events API**.
- [ ] **[Vous]** developers.tiktok.com : créer une app, ajouter **Login Kit** et **Content Posting API** (audit requis pour publier en public), URI de redirection `https://<boutique>/api/admin/social/tiktok/callback`. Pour les dépenses : app **Marketing API** sur business-api.tiktok.com (jeton d'accès + ID annonceur).
- [ ] **[Admin]** Paramètres → Intégrations → TikTok : Client Key, Client Secret, jeton Marketing API, ID annonceur, jeton Events. **Tester**.
- [ ] **[Admin]** Marketing social → Connecteurs → **Connecter TikTok**.

### 3.4 Etsy (vendre aussi les e-books sur Etsy)
- [ ] **[Vous]** Boutique Etsy ouverte (vendeur vérifié, Etsy Payments actif).
- [ ] **[Vous]** etsy.com/developers → *Create a New App* → URL de rappel : `https://<boutique>/api/admin/social/etsy/callback`. Notez la **keystring** et le **shared secret**. Une app neuve est en accès personnel : suffisant pour votre propre boutique.
- [ ] **[Admin]** Paramètres → Intégrations → Etsy : keystring + shared secret. **Tester**.
- [ ] **[Admin]** Marketing social → Connecteurs → **Connecter Etsy** ; cochez les univers servis par la boutique (aucun = tous).
- [ ] **[Admin]** Marketing social → Etsy : activer, état par défaut (brouillon conseillé), majoration du prix, mention IA, **catégorie Etsy pour chaque catégorie** (recherche intégrée).
- [ ] **[Admin]** Fiche produit → section Etsy : vérifier l'aperçu, puis **Publier en brouillon** ; valider sur Etsy.
- [ ] **[Studio]** Paramètres → Pilote automatique → « Publier aussi sur Etsy » (brouillon ou active).
- Détails, règles Etsy (produits numériques, IA, frais) : `apps/shop/docs/ETSY.md`.

### 3.5 Mesure d'audience (facultatif)
- [ ] **[Admin]** Paramètres → Analytics : ID Google Analytics 4, Google Ads, Pinterest. Ils ne se chargent qu'après le consentement du visiteur.

> Tant que les applications Meta et TikTok ne sont pas validées, tout fonctionne en **mode dégradé** : les posts et vidéos sont prêts, à publier en un clic depuis Business Suite ou TikTok, et les dépenses se saisissent à la main. L'attribution des ventes par campagne et la rentabilité fonctionnent dès maintenant.

---

## Phase 4 — Domaines et univers

- [ ] **[Vous]** Acheter les noms de domaine : `lamalleajeux.fr` (et le .com), puis ceux des univers suivants quand ils sont validés (ex. `finileauverte.fr`).
- [ ] **[Vous]** Vercel → projet boutique → Settings → **Domains** → ajouter chaque domaine (et `www.`), puis créer chez le registrar les enregistrements DNS indiqués par Vercel.
- [ ] **[Admin]** Univers : renseigner le domaine principal de chaque univers. Créer les nouveaux univers en statut TEST, les prévisualiser, puis les passer en ACTIF.
- [ ] Facultatif : un domaine « hub » avec sous-domaines de test (`<univers>.votre-hub.fr`), déclaré en *wildcard* sur Vercel, puis la variable `HUB_DOMAIN`.
- [ ] **[Vous]** Pour chaque nouveau domaine : vérification Meta (3.2) et domaine d'envoi Resend (1.4) si l'univers envoie ses propres emails.

---

## Récapitulatif des comptes à créer

| Service | Pour quoi | Coût |
|---|---|---|
| Vercel (déjà fait) | Héberger la boutique et le studio | gratuit (Hobby) |
| Neon (déjà fait) | Base de données | gratuit au départ |
| Cloudflare R2 | Fichiers (PDF, images, vidéos) | gratuit jusqu'à 10 Go |
| Stripe | Paiements | commission par vente |
| Resend | Emails | gratuit jusqu'à 3 000 emails/mois |
| Anthropic | Rédaction et textes pub | à l'usage (≈ 0,50 à 1 $ par e-book) |
| OpenAI | Illustrations | à l'usage (≈ 1 à 5 $ par e-book) |
| Runway | Clips vidéo | à l'usage (≈ 0,05 $/s) |
| Meta Business + app développeur | Pages, pubs, publication auto | gratuit (hors budget pub) |
| Etsy (boutique + app développeur) | Vente des e-books sur Etsy | 0,20 $ par fiche (et par vente) + 6,5 % de commission + frais de paiement |
| TikTok for Business + app développeur | Comptes, pubs, publication auto | gratuit (hors budget pub) |
| Registrar (OVH, Gandi…) | Noms de domaine | ≈ 10 €/an par domaine |

Les tarifs indiqués sont des ordres de grandeur, à vérifier sur les pages de prix de chaque service.
