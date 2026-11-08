# Marketing social : Meta, Instagram, TikTok et rentabilité

Module **Administration → Marketing social** : connexion des comptes, génération de posts et de publicités pour chaque e-book, publication ou programmation, attribution des ventes par campagne et tableau de rentabilité.

## Ce que les plateformes permettent (et pas)

| Besoin | Réalité | Dans la boutique |
|---|---|---|
| Créer un compte publicitaire Meta / TikTok | **Impossible par API.** Vous créez votre Business Manager (business.facebook.com) ou TikTok for Business, puis autorisez l'application (OAuth). | Bouton **Connecter** (Connecteurs). |
| Publier sur une Page Facebook / un compte Instagram pro | Graph API, permissions `pages_manage_posts`, `instagram_content_publish` soumises à **validation de l'app par Meta** (App Review). Avant validation : seuls les comptes de test/administrateurs de l'app fonctionnent. | Publication directe si compte connecté ; sinon mode dégradé. |
| Publier sur TikTok | Content Posting API (photos) après **audit de l'app** ; avant, les posts sont privés (SELF_ONLY). | Idem. |
| Lire les dépenses publicitaires | Marketing API Meta (`ads_read`), Marketing API TikTok (jeton TikTok for Business). | Bouton **Synchroniser** et cron quotidien ; sinon saisie manuelle par jour. |
| Créer des campagnes payantes (budgets, ciblages) | Possible par API mais déconseillé au lancement : à faire dans le Gestionnaire de publicités. | On lie l'ID de campagne externe pour importer ses dépenses. |

**Mode dégradé (toujours disponible)** : génération des textes, bouton *Copier le texte*, téléchargement de l'image, lien direct vers Meta Business Suite ou TikTok, « Marquer publié (manuel) », dépenses saisies à la main. L'attribution des ventes et la rentabilité fonctionnent sans aucune connexion.

## Mise en place

### Meta
1. developers.facebook.com → Créer une app de type **Business** ; ajouter *Facebook Login for Business*, *Instagram Graph API*, *Marketing API*.
2. URI de redirection OAuth : `https://<domaine>/api/admin/social/meta/callback`.
3. Admin → Paramètres → **Intégrations** → Meta : identifiant (App ID) et clé secrète (App Secret), puis **Tester**. (Repli possible : variables `META_APP_ID`, `META_APP_SECRET`.)
4. Permissions à demander à l'App Review : `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `ads_read`, `ads_management`, `business_management`.
5. Admin → Marketing social → Connecteurs → **Connecter**. Les Pages, comptes Instagram professionnels rattachés et comptes publicitaires sont détectés.

### TikTok
1. developers.tiktok.com → app avec **Login Kit** et **Content Posting API** ; redirection `https://<domaine>/api/admin/social/tiktok/callback`.
2. Admin → Paramètres → **Intégrations** → TikTok : client key et client secret (repli : `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`).
3. Dépenses : jeton Marketing API (TikTok for Business) et identifiants des comptes publicitaires, dans la même carte (repli : `TIKTOK_ADS_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_IDS`).

### Conversions serveur
Paramètres → Analytics : `Meta Pixel ID` et `TikTok Pixel ID` ; Paramètres → Intégrations : *Jeton Conversions API* (carte Meta) et *Jeton Events API* (carte TikTok). Chaque commande payée envoie un événement `Purchase` / `CompletePayment` avec l'email haché (SHA-256), la valeur, la devise et `event_id` = identifiant de commande (déduplication avec le pixel navigateur). Traitement par le cron marketing, idempotent (`ConversionEvent`).

### Sécurité
Les jetons OAuth et les clés d'intégration sont chiffrés en base (AES-256-GCM, clé `MARKETING_ENCRYPTION_KEY`, sinon dérivée d'`AUTH_SECRET`). Aucun jeton ni aucune clé n'est envoyé au navigateur : l'administration n'affiche que les 4 derniers caractères.

## Attribution des ventes

- Chaque **campagne** a un slug = `utm_campaign` et un lien tracé : `/aventures/<slug>?utm_source=<facebook|instagram|tiktok>&utm_medium=<paid|social>&utm_campaign=<slug>`. Les posts rattachés ajoutent `utm_content=<id du post>`.
- Au premier atterrissage avec des UTM, la vitrine les mémorise 30 jours (premier contact). Au paiement, ils sont joints à la commande (`Order.utm`).
- **Rentabilité par e-book** : revenus TTC et HT (remboursements déduits), commandes, dépenses pub (campagnes liées au produit), coût de création (fiche produit → Prix → *Coût de création*), marge = HT − pub − création, ROAS = HT / pub, coût par commande, répartition par source.
- **Rentabilité par campagne** : commandes dont `utm_campaign` correspond, revenus, dépenses, ROAS, clics et impressions si synchronisés.

## Génération des posts

- Avec une clé Claude (Paramètres → Intégrations, ou `ANTHROPIC_API_KEY`) : bouton *Générer avec Claude* (modèle `claude-opus-5-5`, sortie JSON validée).
- Sans clé : *Préparer le prompt* → copier dans Claude.ai ou ChatGPT → coller la réponse JSON → validation par le même schéma.
- Le prompt impose : aucun chiffre de ventes, aucun avis ni témoignage, aucune garantie non présente dans la fiche. Tout reste en brouillon jusqu'à votre relecture.
- Formats : Instagram (≤ 2 200 caractères, hashtags), Facebook (texte + lien), TikTok (court, hashtags), publicité Meta (texte principal ≤ 125, titre ≤ 40).

## Tâches planifiées

`/api/cron/marketing` (quotidien sur le plan Hobby) : publication des posts programmés dont l'heure est passée, synchronisation des dépenses des campagnes actives liées à un compte (J-2 → J), envoi des conversions serveur. Le bouton *Publier maintenant* reste immédiat.
