# Arbitrages techniques

Décisions prises pour livrer une plateforme commerciale opérationnelle. Celles marquées ⚠️ méritent votre validation explicite ; les autres sont des choix raisonnables modifiables sans refonte.

## ⚠️ À valider

1. **Monorepo** : le studio existant a été déplacé dans `apps/studio` et la boutique créée dans `apps/shop` (workspace pnpm). Sur Vercel, le projet pointe sur `apps/shop` (Root Directory). Alternative : deux dépôts séparés.
2. **Nom de marque : « La Malle à Jeux »** (la Capitaine Coquelicot reste le personnage du premier produit). Le nom, le logo, le domaine et les textes de marque se modifient dans Admin → Apparence sans déploiement.
3. **Prix du premier produit : 9,90 € TTC provisoire** (champ marqué « à confirmer » dans la seed). Les textes « [À COMPLÉTER] » de la fiche doivent être remplacés par les contenus définitifs.
4. **Achat sans compte client** : l'accès aux fichiers repose sur l'email (lien signé dans l'email de confirmation + lien magique « Retrouver mes achats »). Un espace client avec mot de passe n'est pas implémenté (prévu possible : table Customer déjà en place).
5. **Prix affichés TTC, TVA fixe par produit (20 % par défaut)** : pas de calcul de TVA par pays de l'acheteur (règles OSS UE). Si vous dépassez le seuil de 10 000 € de ventes intra-UE, activer Stripe Tax (`automatic_tax`) — l'architecture le permet (une option à ajouter dans `createCheckoutSession`).
6. **Factures** : facture HTML imprimable générée par la plateforme (numérotation séquentielle annuelle FAC-AAAA-NNNNNN) et facture Stripe activée en parallèle (`invoice_creation`). À faire valider par votre expert-comptable (mentions obligatoires, numérotation).
7. **Textes juridiques** (CGV, confidentialité, mentions légales, cookies, rétractation) créés en brouillon avec un contenu d'attente : à rédiger/valider par un professionnel avant publication. La mention de renonciation au droit de rétractation (L221-28) est affichée au paiement et modifiable dans Paramètres → Commerce.
8. **Hébergement des fichiers** : stockage S3 compatible privé requis en production (R2 Cloudflare recommandé pour le coût de sortie nul). En développement, disque local.
9. **Emails** : Resend retenu (domaine à vérifier). Le marketing de masse (newsletter) est géré par une file d'événements exploitable par un outil dédié (Brevo, Klaviyo…) ; l'envoi des « nouveautés » aux abonnés est réalisé par la plateforme en lots, ce qui convient jusqu'à quelques milliers d'abonnés.
10. **Analytics** : GA4, Google Ads, Meta Pixel, Pinterest chargés uniquement après consentement (bannière intégrée). Aucun outil de CMP tiers.

## Choix techniques (modifiables)

- **Next.js 16 App Router + ISR par tags** : pages publiques statiques régénérées à la modification (admin) ou toutes les 5 minutes.
- **Prisma 6 + PostgreSQL**, montants en centimes, JSON validés par Zod pour les contenus structurés (kit, FAQ, arguments).
- **Auth.js v5 (Credentials + JWT)** pour l'admin : simple, sans table de sessions ; mots de passe bcrypt ; 4 rôles.
- **Stripe Checkout** (page hébergée) plutôt que Payment Element : moins de surface PCI, Apple/Google Pay et codes promo natifs, factures Stripe. Les coupons internes sont synchronisés en coupons Stripe à la volée.
- **Panier côté client (localStorage)** validé intégralement serveur au paiement.
- **Idempotence** : table `StripeEvent` (id Stripe unique) + contrainte unique commande/produit sur les droits de téléchargement.
- **Téléchargements** : jeton opaque par droit, quota (50 par défaut), journal IP/UA, révocation à remboursement total, URL signée 5 min.
- **Recherche** : filtres SQL (ILIKE) suffisants pour quelques milliers de références ; passage possible à Postgres full-text ou Meilisearch ensuite.
- **Illustrations manquantes** : composant `PlaceholderArt` clairement libellé « Illustration à venir » ; aucune image inventée.
- **Tests** : vitest ; tests d'intégration sur une base PostgreSQL `shop_test` (livraison, téléchargements, idempotence, API, protection admin).
