# STORE_UNWRITTEN — Phase 4 : boutique UNWRITTEN (première version)

> Date : 17 novembre 2026 · Périmètre : `apps/shop` uniquement (le studio n'a pas été modifié).
> Décisions appliquées (ARCHITECTURE_UNWRITTEN.md § 10) : même application avec un arbre de routes séparé (A1), un seul compte Stripe avec libellé bancaire par marque (A2), anglais et français pour le pilote (A7).
> Règle tenue : **La Malle à Jeux ne change pas**. Les modifications du socle commun sont additives, rétrocompatibles et couvertes par des tests de non-régression.

## 1. Ce qui est fait

### 1.1 Couche « marque » (extension de `Site`)

| Champ | Valeur par défaut (La Malle à Jeux) | UNWRITTEN |
|---|---|---|
| `kind` | `CATALOG` | `PERSONALIZED` |
| `storefront` | `malle` (arbre `src/app/s`) | `unwritten` (arbre `src/app/u`) |
| `locales[]` | `{fr}` | `{en, fr}` : langues **ouvertes** au public |
| `defaultLocale` | `fr` | `en` |
| `currencies[]` | `{EUR}` | `{EUR}` |

- **Seed** (`src/lib/unwritten/seed.ts`, appelé par `prisma/seed.ts`) : crée la marque UNWRITTEN **seulement si elle est absente**, au statut **TEST**, **sans domaine**. Il ajoute aussi trois collections, trois produits et la version 1 active de chaque questionnaire. Un second passage ne modifie et ne duplique rien.
- **Aperçu** : `/?site=unwritten` (cookie de prévisualisation existant), retour à La Malle à Jeux par `/?site=default`.
- **Réglages propres à la marque** : ils sont stockés dans `Site.settings.unwritten` et validés par Zod (`src/lib/unwritten/config.ts`) :
  - durées de conservation, validité des liens et nombre de téléchargements ;
  - préfixe des commandes (`UW`) et contact.

  Cette clé est ignorée par les réglages de La Malle à Jeux.
- **Admin** : le sélecteur d'univers s'intitule « Marque / univers » et signale les marques personnalisées. Le groupe de menu **UNWRITTEN** n'apparaît que si une marque personnalisée est sélectionnée, ou si « Tous les univers » est choisi et qu'il en existe une.

### 1.2 Migration `20261117100000_unwritten_brand` (purement additive)

- **Ajouts** :
  - 4 types énumérés : `SiteKind`, `QuestionnaireStatus`, `PersonalizationDraftStatus`, `PersonalItemStatus` ;
  - 5 tables : `PersonalizedProduct`, `Questionnaire`, `PersonalizationDraft`, `PersonalOrderItem`, `GiftClaim` ;
  - des colonnes :
    - `Site` : `kind`, `storefront`, `locales`, `defaultLocale`, `currencies`, toutes avec une valeur par défaut identique au comportement actuel ;
    - `OrderItem.personalDraftId` (nullable) ;
    - `DownloadEntitlement.personalItemId` (nullable, unique).
- **Aucune suppression, aucun renommage.** Le fichier `schema.prisma` ne contient que des ajouts : `git diff` ne montre aucune ligne retirée.
- **Vérifications** :
  - `prisma migrate deploy` a été appliquée sur `shop_dev` ;
  - `prisma validate` : schéma valide ;
  - `prisma migrate diff` (base de dev → schéma) : « No difference detected ».

### 1.3 Vitrine UNWRITTEN (`src/app/u/[locale]/…`)

Le proxy choisit cet arbre pour les marques `storefront = "unwritten"`. Pour les autres univers, la réécriture vers `/s/<slug>/…` est inchangée.

| URL publique (EN / FR) | Page |
|---|---|
| `/en`, `/fr` | Accueil éditorial : hero, collections, démonstration du principe (exemple illustratif à personnages fictifs, signalé comme tel), extraits (emplacements réservés, aucun faux contenu), fonctionnement, formats, FAQ, appel final |
| `/en/collections/{slug}` · `/fr/collections/{slug}` | Collection : récit, éditions (déclinaisons), fiche résumée |
| `/en/books/{slug}` · `/fr/livres/{slug}` | Produit : couverture, aperçu intérieur « à venir », formats, pages, langue, délai estimé, prix, éditions, contenu, FAQ, conditions des produits numériques, données structurées `Product` |
| `/en/create/{slug}` · `/fr/creer/{slug}` | Questionnaire, une étape à la fois. Il commence par « Qui va répondre ? » : moi, cadeau que je remplis, cadeau rempli par le destinataire |
| `…/review` · `…/recapitulatif` | Récapitulatif corrigeable, puis paiement |
| `/en/resume/{jeton}` · `/fr/reprendre/{jeton}` | Reprise par lien magique (bouton : le jeton n'est consommé qu'au clic) |
| `/en/order/confirmation` · `/fr/commande/confirmation` | Retour de Stripe. La commande n'est confirmée que par le webhook ; la page se recharge tant qu'elle n'est pas payée |
| `/en/order/{jeton}` · `/fr/commande/{jeton}` | Suivi privé « votre livre est en préparation » : statut, étapes, téléchargement, lien du destinataire d'un cadeau |
| `/en/gift/{jeton}` · `/fr/cadeau/{jeton}` | Le destinataire d'un cadeau complète ses réponses, sans compte |

**Direction artistique** (`src/app/u/unwritten.css`, styles préfixés `.uw-`) :
- **Palette** : ivoire #F7F4EE, noir #171717, champagne #C5A77B en accent discret, pierre #A7A39B, blanc. Deux neutres de lecture (#5C5852, #34322F) assurent le contraste du texte secondaire.
- **Typographie** : Cormorant Garamond pour les titres et Inter pour l'interface, toutes deux sous licence SIL OFL. Elles sont chargées par `next/font/google` (le build y a accès) et auto-hébergées, sans dépendance d'exécution.
- **Sobriété** : mobile d'abord, aucun dégradé, aucun avis, aucun chiffre inventé.
- **Couvertures** : typographiques, en CSS, sans image (une direction par collection). Elles seront remplacées par celles du moteur éditorial.

**i18n** :
- **Dictionnaires typés** : `src/lib/unwritten/i18n/en.ts` sert de type de référence et `fr.ts` doit avoir la même structure, ce qui est vérifié par TypeScript et par un test. Le français utilise l'espace fine insécable avant `? : ! ;`.
- **URLs** : segments localisés (`books` / `livres`, `create` / `creer`…) avec des slugs de produits communs aux deux langues.
- **Choix de la langue** :
  - à la racine, un cookie `uw_locale` mémorise la dernière langue visitée ; sinon `Accept-Language` (q-valeurs) ; sinon la langue par défaut ;
  - une langue fermée redirige vers la langue par défaut.
- **Référencement** :
  - `hreflang` et `x-default`, URL canoniques, métadonnées et Open Graph localisés ;
  - en-tête `Content-Language` ;
  - sitemap par langue avec alternatives ;
  - robots : chemins privés exclus, et tout est exclu tant que la marque est en TEST.
- **Attribut `lang`** : le document racine est partagé avec La Malle à Jeux (`<html lang="fr">`). La langue est donc portée par le conteneur de la vitrine (`<div lang="en">`, valide pour les lecteurs d'écran) et appliquée au document par un script en ligne avant l'affichage (voir limites, § 3).
- **Prix** : affichés via `Intl` (`19,90 €` / `€19.90`) dans la devise de la marque. Ils sont fixés par devise dans `PersonalizedProduct.prices`, sans conversion à la volée. Si aucun prix n'est fixé pour une devise, le produit n'y est pas proposé.

### 1.4 Questionnaire dynamique configurable

- **Définition** :
  - JSON stocké dans `Questionnaire.definition`, validé par Zod (`src/lib/unwritten/questionnaire/schema.ts`) ;
  - contenu : étapes, questions (`single`, `multi`, `text`, `longtext`, `date`, `number`, `info`), conditions d'affichage (`eq`, `neq`, `in`, `nin`, `includes`, `answered`, `empty`, combinables avec `all`, `any`, `not`), champs obligatoires et sensibles, répondant (`buyer` ou `subject`), textes EN et FR obligatoires.
- **Règles vérifiées** :
  - identifiants uniques ;
  - une condition ne cite qu'une question **placée avant**, ce qui exclut toute dépendance circulaire ;
  - une valeur citée doit exister dans les options ;
  - identifiants réservés (`mode`, `review`) refusés ;
  - 20 questions au plus.
- **Versions immuables** : chaque enregistrement crée une version. Un brouillon garde la version avec laquelle il a commencé, et une commande fige la définition utilisée.
- **Moteur** (`engine.ts`, fonctions pures partagées navigateur et serveur, le serveur revalidant toujours) :
  - une réponse à une question masquée n'a aucun effet en cascade et est retirée ;
  - les textes sont normalisés et la longueur, les choix et les dates sont contrôlés.
- **Sobriété** : `lintDefinition` essaie les combinaisons des choix qui pilotent les conditions et avertit en dehors de 5 à 8 questions visibles. Les trois définitions de départ sont dans cette fourchette (testé).
- **Définitions de départ** (`definitions/index.ts`) :
  - **The Secret Book** : couple, famille, amis, développement personnel (avec la mention « jamais de conseil médical »), aventure ;
  - **Before It's Too Late** : parents, grands-parents, couple, enfants (tranche d'âge seulement), amis ;
  - **The Movie of My Life** : toute une vie ou un chapitre ; lieux, dates, souvenirs (rédigés comme des souvenirs, jamais comme des faits), anecdotes ; photos « plus tard » sous forme de simple information.
- **Brouillon** `PersonalizationDraft` :
  - sauvegarde à chaque étape et expiration glissante ;
  - rattachement au navigateur par un cookie httpOnly signé (`uw_drafts`, 5 brouillons au plus) ;
  - reprise par **lien magique** signé à usage unique (même principe que les créatrices) : un lien émis avant la dernière reprise est refusé, et sa validité est configurable (72 h par défaut).
- **Récapitulatif** des informations importantes, chaque étape pouvant être corrigée avant paiement.

### 1.5 Commande personnalisée

- **Paiement** : `createCheckoutSession` accepte une ligne `{ kind: "personalized", id, draftId }`.
  - Le brouillon est **figé** (statut `CHECKOUT`) pendant la session. Il est libéré si la session expire ou échoue, ou au bout d'une heure sans confirmation.
  - Le prix est relu côté serveur dans la devise.
  - La copie figée des réponses et de la définition est placée dans `OrderItem.snapshot`.
  - Un seul livre personnalisé par produit et par commande.
  - Options facultatives de la session : devise, langue Stripe, URL de retour, préfixe et métadonnées. **Sans elles, les paramètres Stripe de La Malle à Jeux sont strictement identiques** (testé clé par clé).
- **Webhook existant**, toujours idempotent : dans la même transaction que le passage en PAID, un `PersonalOrderItem` est créé par ligne personnalisée (clé unique `orderItemId`), au statut `PENDING_GENERATION`, ou `AWAITING_RECIPIENT` pour un cadeau rempli par le destinataire.
  - **Aucune génération n'est lancée**.
  - Aucun droit sur des fichiers communs n'est créé.
  - Le brouillon passe à `ORDERED` et ses réponses sont **effacées** : elles vivent désormais dans la commande.
  - L'e-mail de confirmation est remplacé, pour ces commandes seulement, par un e-mail localisé « votre livre est en préparation » qui contient le lien de suivi.
- **Remboursement total** : les livres non livrés passent à `CANCELLED` et les liens cadeau sont révoqués.
- **Livraison** :
  - un droit de téléchargement **individuel** (`DownloadEntitlement.personalItemId`) donne accès au seul PDF de ce livre ;
  - un e-mail localisé « votre livre est prêt » est envoyé à l'acheteur, et au destinataire s'il a rempli lui-même le cadeau.

### 1.6 API v1 pour le studio (à brancher côté studio)

**Authentification et règles** :
- Authentification par clé (`Authorization: Bearer`), avec les nouveaux scopes `personal:read` et `personal:write` (`write` implique `read`), à créer dans « API & automatisation ».
- Limite : 60 requêtes par minute.
- Chaque transition est inscrite au journal d'audit, sans donnée personnelle.
- **Minimisation** : le studio ne reçoit ni e-mail, ni nom de facturation, ni adresse, seulement ce qui sert à écrire le livre.

| Méthode et route | Rôle |
|---|---|
| `GET /api/v1/personal/items?status=PENDING_GENERATION,ERROR&limit=20&after=<id>` | Livres à produire, par ordre de paiement. Par défaut : `PENDING_GENERATION`. Les cadeaux en attente du destinataire ne sont jamais listés |
| `GET /api/v1/personal/items/:id` | Détail : langue, mode, produit (`collectionKey`, pages, formats), définition figée, réponses, prénom et message du cadeau |
| `POST …/:id/production` `{ studioRef? }` | `PENDING_GENERATION` ou `ERROR` → `IN_PRODUCTION` (idempotent) |
| `POST …/:id/error` `{ message }` | → `ERROR` (compteur, dernier message technique) |
| `POST …/:id/file/presign` `{ name }` | URL présignée de 15 min vers le stockage **privé** (même mécanisme que les fichiers produits). Retourne `null` en stockage local |
| `POST …/:id/file/register` `{ key, name }` | Enregistre le PDF déposé, dont la taille est lue dans S3 (500 Mo au plus) |
| `POST …/:id/file` (multipart `file`) | Envoi direct d'un petit PDF (4 Mo au plus) ; signature `%PDF-` vérifiée |
| `POST …/:id/deliver` | Livraison : droit individuel, statut `DELIVERED`, e-mail. Idempotent : ni droit ni e-mail en double |

Réponse : `{ data: … }` au format de `serializeForStudio` (`src/lib/unwritten/orders.ts`) ; erreurs `{ error }` avec les codes 401, 403, 404, 409, 422 et 429.

### 1.7 Option cadeau

- **Trois modes** :
  - « je le remplis » ;
  - « un cadeau que je remplis » ;
  - « un cadeau qu'il ou elle remplit ».
- **Données sur le destinataire** : le prénom et l'e-mail sont **facultatifs**. Sans e-mail, l'acheteur reçoit le lien et le transmet lui-même. Aucune autre donnée sur un tiers n'est exigée.
- **Questions par répondant** : en mode destinataire, l'acheteur ne répond qu'aux questions `buyer` (édition, dédicace…). Seules ces réponses sont figées au paiement, puis le destinataire complète les questions `subject`. L'édition choisie par l'acheteur n'est pas modifiable.
- **Lien du destinataire** : seul son hachage est stocké. Il est **révocable par rotation** (relance depuis l'admin, ou « afficher un nouveau lien » sur la page de suivi), expire (60 jours par défaut) et n'est jamais indexé.

### 1.8 Administration (en français)

- **Livres personnalisés** (`/admin/unwritten`) :
  - liste filtrable par statut, avec compteurs ;
  - fiche détaillée (`/admin/unwritten/[id]`) : brouillon figé lisible (questions, réponses, champs sensibles signalés), dates, erreur du studio, cadeau (envoyé, ouvert, répondu), fichier, téléchargements ;
  - actions : relancer le destinataire, remettre en file un livre en erreur, renvoyer l'e-mail de livraison.
- **Questionnaires** (`/admin/unwritten/questionnaires`) : édition JSON validée (erreurs lisibles, avertissements de sobriété), enregistrement en brouillon ou publication, historique des versions et publication d'une ancienne version.
- **Langues & prix** (`/admin/unwritten/reglages`) :
  - interrupteur d'ouverture par langue et langue par défaut ;
  - durées de conservation et de validité, téléchargements, préfixe, contact ;
  - prix TTC par produit et par devise (recopiés dans `Product.priceCents` pour la devise du produit), délai estimé, nombre de pages.

### 1.9 RGPD minimal

- **Consentement explicite** pour les champs sensibles :
  - case à cocher dans l'étape concernée ;
  - une réponse sensible est refusée sans ce consentement ;
  - le consentement est horodaté et son texte conservé ;
  - sans consentement, les réponses sensibles sont retirées avant le paiement.
- **Conservation** :
  - brouillon : expiration glissante, 30 jours par défaut, réglable ;
  - réponses effacées dès la commande (copiées dans `PersonalOrderItem`) ;
  - réponses du livre effacées 90 jours après la livraison ou l'annulation (réglable) par `GET /api/cron/unwritten` (purge).
- **Suppression par le client** : bouton « Supprimer mes réponses » (suppression définitive du brouillon).
- **Journaux sans donnée personnelle** dans tout le code UNWRITTEN : identifiants techniques seulement, jamais de réponse ni d'e-mail.
- **Limitation du débit** (`src/lib/unwritten/rate-limit.ts`) :
  - sauvegardes du questionnaire ;
  - création de brouillons ;
  - liens magiques (par e-mail haché et par IP) ;
  - ouverture de jetons ;
  - démarrage du paiement.
- **Robots exclus** des pages privées (suivi, cadeau, reprise, questionnaire, confirmation) : `noindex`, `no-referrer`.

### 1.10 Compatibilité avec le volet viral (VIRAL_UNWRITTEN.md), prévue mais non développée

1. **Cadeau programmé et page de révélation** : `GiftClaim.sendAt` (envoi programmé) et `GiftClaim.revealedAt` (révélation) existent déjà.
   - Si `sendAt` est renseigné, l'e-mail au destinataire n'est pas envoyé au paiement : le lien est remis à l'acheteur, en attendant la tâche planifiée qui l'enverra à la date choisie.
   - La page `/gift/{jeton}` deviendra la page de révélation.
2. **Contributions de proches** :
   - `PersonalizationDraft.contributions` (JSON, `[]`) est réservé aux réponses de contributeurs invités ;
   - chaque question porte un indicateur `contributable` ;
   - le moteur évalue déjà les conditions sur des réponses issues de plusieurs répondants (acheteur et destinataire).

   Les modèles `ContributorInvite` et `Contribution` de VIRAL_UNWRITTEN.md s'ajouteront sans toucher à l'existant.
3. **Liens publics** : tous les liens actuels (suivi, cadeau, reprise) sont privés par défaut, `noindex`, révocables (rotation ou usage unique) et à jeton non devinable. Le futur `ShareLink` suivra la même règle.
4. **Attribution `ref`** :
   - le proxy conserve `?ref=` dans un cookie httpOnly de 30 jours (dernier clic, valeur assainie) ;
   - la valeur est copiée avec les UTM existants sur le brouillon, puis dans `Order.utm` au paiement.

   Testé : `ref` présent sur la commande.

## 2. Résultats de vérification (17 novembre 2026)

- `npx tsc --noEmit -p .` : 0 erreur.
- `npx vitest run` : **23 fichiers, 211 tests réussis** (160 existants + 51 nouveaux), sur la base `shop_test` :

| Fichier | Couverture |
|---|---|
| `unwritten-questionnaire.test.ts` (16) | Conditions, filtrage par répondant, validation des réponses et du consentement, validation des définitions (dépendance avant, valeurs, doublons, traductions, identifiants réservés, JSON invalide), sobriété des trois définitions |
| `unwritten-i18n.test.ts` (13) | Dictionnaires identiques, typographie, routes localisées, changement de langue, `hreflang`, négociation, décisions du proxy, `ref`, formats de prix, prix par devise |
| `unwritten-orders.test.ts` (15) | Brouillon, reprise (jeton expiré, falsifié, déjà utilisé), expiration, suppression, purge, verrou de paiement, ligne personnalisée, webhook idempotent (rejeu, deuxième événement, appel direct : un seul livre), remboursement, API du studio de bout en bout, téléchargement individuel, parcours cadeau complet, rotation du lien |
| `malle-non-regression.test.ts` (7) | Réécritures du proxy (accueil, fiche, panier, confirmation), absence de redirection de langue, aperçu, paramètres Stripe identiques, panier, webhook, livraison, e-mail habituel, univers par défaut intact, seed sans effet |

- **`npx next build`** : réussi. Les pages `/u/[locale]/…` sont dynamiques ; les pages de La Malle à Jeux gardent leur rendu statique ou ISR.
- **`prisma validate`** : valide. **`prisma migrate diff`** : aucune différence.
- **`pnpm install --frozen-lockfile`** : non nécessaire, **aucune dépendance ajoutée**.
- **`eslint`** : aucun problème dans les fichiers ajoutés ou modifiés. Les 23 erreurs restantes sont antérieures et se trouvent dans des fichiers non modifiés.
- **Parcours réel dans Chromium** (Playwright, build de production) : questionnaire complet avec erreur de validation et consentement, récapitulatif EN et FR, suivi, cadeau, suppression du brouillon. Captures (37) dans `/tmp/claude-0/-home-user-Activit-enfant/c7dda0b2-f8fe-52e2-a668-6285f4e83eb6/scratchpad/unwritten-store/`.

## 3. Limites connues de cette version

- **Langue du document** : `<html lang>` reste « fr » côté serveur, car le layout racine est commun à La Malle à Jeux. La langue est portée par le conteneur `lang` et corrigée par script avant l'affichage. Solution propre, plus tard : plusieurs layouts racines par groupes de routes (déplacement de fichiers de La Malle à Jeux, donc à planifier).
- **Feuilles et polices de La Malle à Jeux** : la vitrine charge aussi celles du document racine (Fredoka, Nunito, `globals.css`). Elles sont inutiles mais sans effet visuel, puisque tout est préfixé `.uw-`.
- **Rendu dynamique** de la vitrine : la marque est lue dans l'en-tête posé par le proxy. Un cache est à prévoir avant un fort trafic.
- **Limitation du débit en mémoire**, par instance : elle n'est pas partagée entre fonctions serverless. Une solution partagée (Redis, Upstash…) est à prévoir à l'ouverture.
- **Promotions** : les prix barrés (`salePriceCents`) ne s'appliquent pas encore aux produits personnalisés. Les codes promo existants s'appliquent.
- **Pages La Malle générées pour UNWRITTEN** : le build prégénère aussi des pages `/s/unwritten/…`, à cause du `generateStaticParams` de La Malle à Jeux, laissé intact. Elles sont inaccessibles (le proxy n'y mène jamais).
- **Sitemap partagé** : en aperçu, le sitemap et le robots.txt suivent le cookie de prévisualisation.
- **Purge quotidienne non planifiée** : `/api/cron/unwritten` existe mais n'est pas déclarée dans `vercel.json`, pour ne pas toucher aux tâches planifiées existantes (offre Vercel à confirmer, voir § 5).

## 4. Ce qui reste à faire

1. **Aperçu partiel avant paiement** : 2 à 4 pages en profil ECO, avec un plafond de coût et de fréquence par visiteur. Il dépend du moteur éditorial du studio.
2. **Branchement du studio** sur l'API § 1.6 :
   - interrogation de la file ;
   - `Book.origin = ORDER` et `Book.orderRef = id` ;
   - dépôt du PDF et livraison.

   Côté boutique, rien d'autre n'est nécessaire.
3. **Bibliothèque client complète** : compte léger par lien magique, réunissant tous les livres. Aujourd'hui, un lien de suivi par commande suffit.
4. **Devises multiples** :
   - la structure est prête (prix par devise, `Site.currencies`) ;
   - il reste le choix de la devise par marché, l'affichage et les tests Stripe par devise ;
   - la TVA des produits numériques vendus dans l'UE (guichet OSS) reste à traiter.
5. **SEO d'intentions d'achat** : pages « idée cadeau parents », « livre pour grands-parents »…, contenus marketing natifs par langue, images Open Graph.
6. **Volet viral** (§ 1.10), dans l'ordre de VIRAL_UNWRITTEN.md.
7. **Photos et souvenirs client** (Movie of My Life) : envoi, chiffrement, suppression des métadonnées, conservation.
8. **Validation client** des informations importantes avant la version définitive, si elle est retenue.

## 5. Configuration et validations humaines nécessaires

- **Juridique**, textes à valider par un juriste avant ouverture :
  - conditions des produits numériques ;
  - mention du droit de rétractation (art. L221-28 : bien personnalisé ou contenu numérique) ;
  - CGV, mentions légales et politique de confidentialité UNWRITTEN, en EN et en FR.
- **Engagements affichés à confirmer** :
  - délais estimés (3 à 7 jours ouvrés par défaut, réglables) ;
  - nombre de pages (repris de l'architecture) ;
  - format A5 ;
  - phrase « nous n'utilisons pas vos réponses pour entraîner des modèles d'IA », à confirmer avec les conditions contractuelles des fournisseurs d'IA.
- **Domaine** (A3) : à acheter, puis à renseigner dans « Univers & domaines » et à passer la marque en ACTIVE. Ajouter le domaine à Resend pour les e-mails.
- **Stripe** : compte unique, libellé « UNWRITTEN » automatique. Vérifier les moyens de paiement et la page Checkout en anglais, et créer la clé d'API du studio (scopes `personal:*`).
- **Tâche planifiée** : déclarer `/api/cron/unwritten` dans `vercel.json`, une fois par jour, en tenant compte des limites de l'offre Vercel.
- **Déploiement** : le build exécute le seed, donc la marque UNWRITTEN (TEST, sans domaine) sera créée en production au prochain déploiement.
  - Elle reste invisible, sauf par `?site=unwritten`, qui reste accessible à quiconque connaît le slug : c'est le principe actuel des univers en test.
  - Préproduction recommandée.
- **Ouverture d'une langue** : uniquement quand paiement, mentions, CGV et contenus sont validés (interrupteur dans « Langues & prix »).
- **Relecture native** des textes anglais de la vitrine par un locuteur natif.

## 6. Constats sur l'existant (non modifiés, à arbitrer)

Ces points sont antérieurs à cette phase et touchent La Malle à Jeux : je ne les ai donc pas corrigés.

- **`/categories/{slug}` répond en erreur 500** (`DYNAMIC_SERVER_USAGE`) dans une build de production locale.
  - **Reproduit à l'identique sur la version d'origine** (HEAD reconstruite à part, même base).
  - Cause probable : page ISR qui lit `searchParams`, et `generateStaticParams` qui ne prégénère aucune catégorie.
  - Les préchargements de liens depuis l'accueil produisent ces erreurs dans les journaux.
- **Lien `/commande/{jeton}` des e-mails de La Malle à Jeux** : il contient des points (jeton signé `charge.expiration.signature`). Or le proxy traite tout dernier segment contenant un point comme un fichier, sans réécriture : la page répond 404 en build locale.
  - À confirmer en production.
  - UNWRITTEN évite le problème en remplaçant `.` par `~` dans ses jetons d'URL.
