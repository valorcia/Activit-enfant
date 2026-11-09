# Etsy — publier les e-books et suivre les ventes

La boutique publie chaque e-book comme **produit numérique** (fiche « téléchargement ») sur votre boutique Etsy, synchronise l'état des fiches et importe les ventes Etsy dans la rentabilité (Marketing social).

## 1. Créer l'application Etsy

1. Connectez-vous à etsy.com avec le compte de la boutique, puis ouvrez **etsy.com/developers** → *Your apps* → **Create a New App**.
2. Nom : par exemple « La Malle à Jeux — publication ». Décrivez l'usage : publication de vos propres fiches et lecture de vos ventes.
3. **Callback URL** : `https://<boutique>/api/admin/social/etsy/callback` (une par domaine d'administration, par ex. `https://lamalleajeux.fr/api/admin/social/etsy/callback` ; ajoutez aussi l'URL Vercel si vous administrez depuis celle-ci).
4. Notez la **keystring** et le **shared secret**. Une app neuve dispose d'un accès *personnel* : il suffit pour gérer votre propre boutique (l'accès commercial n'est nécessaire que pour servir d'autres vendeurs).

Permissions demandées à la connexion : `listings_r listings_w listings_d shops_r transactions_r`.

## 2. Saisir les clés

Admin → Paramètres → **Intégrations** → carte **Etsy** : keystring et shared secret (chiffrés en base ; variables `ETSY_API_KEY` / `ETSY_SHARED_SECRET` possibles en repli). **Tester** appelle `GET /openapi-ping`.

L'en-tête `x-api-key` est envoyé au format `keystring:shared_secret` (format exigé par Etsy depuis 2025) ; si Etsy le refuse, la boutique bascule automatiquement sur la keystring seule.

## 3. Connecter la boutique

Admin → Marketing social → **Connecteurs** → **Connecter Etsy** : autorisation OAuth 2.0 avec PKCE. Les jetons sont chiffrés ; le jeton d'accès (≈ 1 h) est rafraîchi automatiquement, le jeton de rafraîchissement (≈ 90 jours) est renouvelé chaque jour par la tâche planifiée. Si l'autorisation est révoquée, un bandeau demande de reconnecter.

Cochez les **univers** servis par la boutique (aucune case = tous les univers). Plusieurs boutiques Etsy peuvent coexister (une par univers).

## 4. Réglages (par univers)

Admin → Marketing social → **Etsy** (univers choisi dans le sélecteur du menu) :

| Réglage | Rôle |
|---|---|
| Publication activée | autorise l'API et l'autopilote du studio (la publication manuelle reste possible) |
| Boutique | boutique utilisée pour cet univers (sinon la première rattachée) |
| État à la création | **Brouillon** (conseillé : vous vérifiez sur Etsy) ou Active |
| Majoration / arrondi | prix Etsy = prix boutique × (1 + majoration), arrondi à x,90 ou x,99 |
| Qui l'a fait | champ obligatoire Etsy (« Moi » par défaut) |
| Renouvellement automatique | Etsy refacture 0,20 $ tous les 4 mois |
| Mention IA | texte ajouté à la description (activé par défaut) |
| Catégories Etsy | `taxonomy_id` par catégorie de la boutique, avec recherche dans la taxonomie Etsy ; valeur par défaut |
| Hypothèses de frais | commission, frais de paiement, mise en vente : servent au net estimé |

## 5. Publier

- **Fiche produit** (admin) → section **Etsy** : aperçu modifiable (titre ≤ 140 caractères, 13 mots-clés ≤ 20 caractères, description en texte brut, prix), frais estimés, boutons *Publier en brouillon*, *Publier et activer*, *Mettre à jour*, *Désactiver*, *Ouvrir sur Etsy*. Les modifications sont enregistrées comme surcharges et réutilisées aux mises à jour.
- **API** : `POST /api/v1/products/:id/etsy` (voir `docs/API.md`).
- **Studio** : étape « Etsy » de l'autopilote, après la publication sur la boutique (Paramètres → Pilote automatique → « Publier aussi sur Etsy »). Sans boutique connectée, l'étape est marquée « ignorée ».

Publication **idempotente** : une seule fiche par produit et par boutique ; les images (10 max, converties en JPEG) et les fichiers (5 max, 20 Mo max chacun — un PDF plus lourd est refusé avec un message explicite) ne sont renvoyés que s'ils ont changé. Quantité : 999 (produit numérique).

## 6. Suivi et rentabilité

- Marketing social → **Etsy** : état des fiches, dernières ventes, totaux 30 jours, **Synchroniser maintenant**.
- Tâche planifiée `/api/cron/marketing` (quotidienne sur Vercel Hobby) : rafraîchissement des jetons, état des fiches (une fiche supprimée sur Etsy passe en « Supprimée »), import des reçus payés.
- Chaque ligne de reçu devient une vente externe unique (`reçu:transaction`) : pas de doublon, et jamais confondue avec une commande de la boutique.
- Rentabilité : colonne **Etsy** (brut, frais estimés, net), source « etsy ». Le **TTC** compte le montant payé, le **HT** compte le **net après frais** : sur les produits numériques vendus dans l'UE, Etsy collecte et reverse la TVA lui-même.

## 7. Règles Etsy à respecter

- **Produits numériques** : la description indique « Produit numérique : aucun objet physique ne sera envoyé » ; l'acheteur télécharge les fichiers depuis Etsy après paiement.
- **Création** : Etsy n'accepte que des articles conçus par le vendeur. Les e-books générés avec l'aide de l'IA sont autorisés à condition de le **signaler** dans la description (mention IA, activée par défaut) — ne la désactivez que si aucun contenu n'en est issu.
- Pas de faux avis, pas d'urgence artificielle, pas de marques ou personnages protégés dans les titres et mots-clés.
- **Frais** (à vérifier sur votre relevé) : 0,20 $ par mise en vente et à chaque vente (renouvellement), 6,5 % de commission sur le prix, frais de paiement Etsy Payments (≈ 4 % + 0,30 € en France). Le studio estime 0,20 $ par fiche dans le coût d'un e-book.
- Limites API : environ 10 requêtes/s et 10 000 par jour ; la boutique espace ses appels et réessaie sur `429`.

## Points non vérifiés contre l'API réelle

L'environnement de développement n'avait pas accès à `openapi.etsy.com` : l'intégration suit la documentation Open API v3 et est couverte par des tests avec un faux serveur. À contrôler lors du premier essai : format de l'en-tête `x-api-key` (bascule automatique), valeurs acceptées de `when_made` (`made_to_order` par défaut), mise à jour du prix via `PUT /listings/{id}/inventory`, paramètres `min_created` / `was_paid` des reçus.
