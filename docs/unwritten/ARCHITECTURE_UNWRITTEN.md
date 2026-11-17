# ARCHITECTURE_UNWRITTEN — Phase 1 : architecture multimarque et moteur commun

> Statut : **proposition**. Les points marqués 🟠 attendent un arbitrage (§ 10). Rien de ce document ne modifie La Malle à Jeux tant qu'il n'est pas validé.

## 1. Principe

```
                    ┌──────────────────────────────────────────────┐
                    │                STUDIO CENTRAL                │
                    │  (apps/studio + worker, moteurs communs)     │
                    │  Rédaction · Illustration · Composition ·   │
                    │  Contrôle qualité · Export · Coûts · Vidéo   │
                    └───────────────▲───────────────┬──────────────┘
                     API v1 (clé)   │               │ Livre produit
                                    │               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BOUTIQUE MULTIMARQUE (apps/shop)                 │
│  Socle commun : paiements Stripe · commandes · droits de             │
│  téléchargement · e-mails · admin · marketing · affiliation          │
│                                                                      │
│   Marque « La Malle à Jeux »        Marque « UNWRITTEN »   Futures   │
│   (vitrine actuelle, inchangée)     (vitrine premium,      marques   │
│                                      multilingue)                    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Le studio reste le seul moteur de production.** Il ne connaît que des « briefs » et des « livres ». Il ignore la marque, à part le thème graphique et les règles de production fournis dans le brief.
- **La boutique porte les marques.** Chaque marque a ses domaines, langues, devises, prix, collections, produits, commandes, statistiques, SEO et modèles d'e-mails.
- **Aucune duplication du socle** : paiement, livraison, administration et marketing sont communs. Seules les vitrines et les réglages diffèrent.

## 2. Modèle multimarque

Le modèle `Site` existant (univers multi-domaines, réglages par univers, thème, sélecteur dans l'admin) devient la **marque** :

| Ajout | Rôle |
|---|---|
| `Site.kind` = `CATALOG` (La Malle à Jeux) ou `PERSONALIZED` (UNWRITTEN) | Choisit la vitrine et le parcours d'achat |
| `Site.locales[]`, `Site.defaultLocale`, `Site.currencies[]` | Langues et devises de la marque |
| `Site.storefront` = `malle` ou `unwritten` | Arbre de routes et design system utilisés |
| Réglages par marque : e-mails, mentions légales, Stripe (compte ou libellé), SEO | Isolation de la configuration |
| `brandId` (= `siteId`) obligatoire sur produits, commandes, clients, coûts | Isolation des données ; filtres de l'admin |

- **Vitrines** : `src/app/s/[site]/(storefront)` reste celle de La Malle à Jeux, sans modification. UNWRITTEN reçoit un arbre dédié `src/app/u/[locale]/…`, choisi par `proxy.ts` selon le domaine. 🟠 (alternative : application séparée, § 10)
- **Admin** : le sélecteur d'univers existant devient un sélecteur de marque. Les écrans propres à UNWRITTEN (questionnaires, commandes en génération, contrôle qualité) n'apparaissent que pour une marque `PERSONALIZED`.

## 3. Produit personnalisé : du questionnaire à la livraison

```
Questionnaire ─► Brouillon de commande ─► Aperçu partiel ─► Paiement Stripe
  (dynamique,      (sauvegardé, repris       (2 à 4 pages,       (webhook vérifié,
   sauvegardé)      par lien magique)         profil ECO)         idempotent)
                                                                     │
       ┌─────────────────────────────────────────────────────────────┘
       ▼
Demande de génération (boutique → studio, API v1, priorité « commande »)
       │
       ▼
Pipeline studio : A Brief → B Architecture narrative → C Rédaction → D Bible visuelle
                  → E Illustrations → F Composition → G Contrôle qualité → H Export
       │                                     │
       │                                     └── défaut critique ⇒ blocage,
       │                                         régénération ciblée, sinon file humaine
       ▼
Validation client (optionnelle : relecture des informations importantes avant la version définitive)
       │
       ▼
Livraison : droit de téléchargement individuel + bibliothèque client + e-mail (lien temporaire)
```

**Règles :**
- **Pas de génération complète avant paiement.** L'aperçu partiel est produit en profil ECO, avec un plafond de coût et de fréquence par visiteur (anti-abus).
- **Le paiement seul déclenche la production.** Elle repose sur le webhook existant, rendu idempotent par commande et par article.
- **Chaque étape est reprenable**, sur le modèle du pilote automatique actuel. Le budget maximal par commande est bloquant.
- **Contrôle qualité bloquant** : la livraison n'a lieu que si aucun défaut critique n'est détecté.
- **Souvenirs** : ceux qui ne sont pas documentés sont rédigés comme des souvenirs (« Tu racontes souvent que… »), jamais présentés comme des faits.

## 4. Données nouvelles (boutique)

| Modèle | Contenu |
|---|---|
| `Questionnaire` | Définition versionnée par produit : étapes, questions, conditions d'affichage, validations, champs sensibles |
| `PersonalizationDraft` | Réponses en cours, langue, produit, destinataire, statut, jeton de reprise, date d'expiration |
| `GiftCode` | Achat cadeau : le destinataire complète lui-même ses informations |
| `PersonalOrderItem` | Lien commande ↔ brouillon figé ↔ demande de génération ↔ livre ↔ PDF individuel ↔ statut |
| `CustomerUpload` | Photos et documents du client : stockage privé chiffré, conservation limitée, suppression |
| `UnlockableContent` | Contenus débloquables par QR code (jeton signé), avancement sauvegardé |
| `OrderCost` | Coûts par commande : IA, images, Stripe, stockage, traitement, tentatives, marge |

**Côté studio** : `Book.origin = ORDER`, `Book.orderRef`, `Book.profile` (ECO, STANDARD ou PREMIUM), `Book.bible` (bible visuelle), coût consolidé par livre déjà disponible dans `GenerationLog`.

## 5. Moteur éditorial premium (studio)

Les gabarits actuels, orientés kits pour enfants, sont conservés pour La Malle à Jeux. On ajoute un second moteur de composition, sans toucher au premier :

1. **Formats** : A4, **A5**, carré, **portrait 3:4**, personnalisé ; marges intérieures et extérieures pour l'impression.
2. **Grille de composition** : colonnes, gouttières, ligne de base, échelle typographique.
3. **Flux de texte paginé** :
   - mesure réelle dans Chromium plutôt qu'estimation ;
   - veuves et orphelines, césure par langue (CSS `hyphens` + `lang`) ;
   - sauts de chapitre sur page impaire en mode impression.
4. **Gabarits** : couverture, faux-titre, dédicace, sommaire, ouverture de chapitre, pleine page illustrée, double page, texte et illustration, citation, activité, souvenir (espace à remplir), conclusion, quatrième de couverture.
5. **Bibliothèque de couvertures** : au moins trois directions artistiques distinctes par collection.
6. **Polices sous licence libre (SIL OFL)**, embarquées, sans dépendance réseau au rendu.
7. **Exports** :
   - **écran** : images optimisées ;
   - **impression** : fond perdu de 3 mm et zones de sécurité. Il n'est présenté comme « prêt pour l'imprimeur » qu'après validation des spécifications de l'imprimeur choisi.
8. **Contrôle qualité** (étape G) :
   - **contrôles existants** : débordements, images manquantes, résolution ;
   - **à ajouter** : pages vides et grands espaces involontaires, contraste du texte sur les images, pagination, QR codes décodables, présence et exactitude des données de personnalisation, répétitions, cohérence des personnages (modèle de vision).

## 6. Échelonnement des modèles IA et profils de production

| Tâche | Modèle proposé (Claude) | Raison |
|---|---|---|
| Extraction et normalisation du questionnaire, classification, contrôles simples | Haiku 5.5, effort `low` | Tâches courtes et structurées |
| Architecture narrative, bible visuelle | Sonnet 5.5 | Bon rapport qualité / coût |
| Rédaction des chapitres | Sonnet 5.5 (STANDARD) ou Opus 5.5 (PREMIUM) | Écriture créative |
| Révision éditoriale finale | Opus 5.5, effort `medium` | Cohérence et style |
| Traduction de l'interface et du marketing | Rédaction directe dans la langue, puis relecture humaine des pages marketing | Éviter le littéral |

| Profil | Usage | Texte | Images |
|---|---|---|---|
| **ECO** | Aperçus, tests | Haiku ou Sonnet, effort `low` | `gpt-image-1-mini` qualité basse, peu d'images |
| **STANDARD** | Commandes courantes | Sonnet + révision Opus | Couverture qualité haute, intérieur `mini` moyenne |
| **PREMIUM** | Collection 3, options payantes | Opus | Toutes les images en qualité haute |

Les profils sont configurables dans l'admin (modèles, effort, nombre d'images, qualité, budget maximal). Les contrôles de sécurité et de qualité minimale ne dépendent jamais du profil.

**Autres leviers d'économie** :
- **API Batch** (−50 % sur le texte, vérifié dans la documentation Anthropic) pour les commandes non urgentes ;
- **mise en cache** des consignes stables ;
- **réutilisation** des ornements et fonds de collection ;
- **illustrations seulement là où elles apportent** ;
- **régénérations plafonnées** à 2 par élément.

## 7. Coûts de revient prévisionnels par collection (estimations)

**Ce sont des estimations, pas des mesures.** Hypothèses :
- **Texte** : tarifs Claude publics vérifiés (Opus 5.5 4 $ / 20 $, Sonnet 5.5 2 $ / 10 $, Haiku 5.5 0,10 $ / 0,50 $ par million de jetons). La réflexion du modèle est comptée en sortie, estimée à +80 % des jetons écrits.
- **Images** : tarifs OpenAI **tels que codés dans le studio, non vérifiés** (`gpt-image-1` haute 0,167 $, moyenne 0,042 $ ; `mini` moyenne 0,011 $ ; ×1,5 hors format carré).
- **Stripe** : commission non vérifiée, à confirmer pour chaque pays.

| Collection (prix) | Contenu supposé | Texte STANDARD | Texte avec API Batch | Images STANDARD | Total technique estimé | Objectif |
|---|---|---|---|---|---|---|
| The Secret Book (19,90 €) | 32 à 40 p. A5, ≈ 9 000 mots, couverture + 6 illustrations | ≈ 0,80 $ | ≈ 0,40 $ | ≈ 0,35 $ | **≈ 0,75 à 1,15 $** | < 1 € : atteignable avec l'API Batch |
| Before It's Too Late (24,90 €) | 40 p., ≈ 10 000 mots, couverture + 8 illustrations | ≈ 0,90 $ | ≈ 0,45 $ | ≈ 0,40 $ | **≈ 0,85 à 1,30 $** | — |
| The Movie of My Life (39,90 €) | 70 à 90 p., ≈ 30 000 mots, couverture + 10 illustrations | ≈ 1,50 à 2,40 $ | ≈ 0,75 à 1,20 $ | ≈ 0,90 $ | **≈ 1,65 à 3,30 $** | < 3 € : atteignable avec l'API Batch et une révision ciblée |

S'ajoutent à chaque commande les frais Stripe (environ 1,5 % + 0,25 € pour une carte européenne selon la grille courante, **à vérifier**), ainsi que le stockage et le traitement, qui restent faibles et seront mesurés. **Ces chiffres seront remplacés par les coûts mesurés des trois livres de démonstration** (phase 6).

## 8. Internationalisation

- **Périmètre** : vitrine et e-mails UNWRITTEN uniquement ; l'administration reste en français.
- **URLs** : `/{locale}/…` avec slugs localisés, `hreflang`, URLs canoniques, sitemap par langue.
- **Langue et devise** : détection par `Accept-Language` avec sélecteur manuel mémorisé ; devise par marché, prix fixés par devise (pas de conversion à la volée), formats de date et de nombre via `Intl`.
- **Livres rédigés directement dans la langue choisie**, avec typographie adaptée : espaces fines en français, guillemets, césure.
- **Ouverture d'un marché seulement** quand paiement, mentions légales, CGV et contenus sont validés pour ce pays. Interrupteur par langue dans l'admin.

## 9. Sécurité et RGPD

- **Minimisation** : le questionnaire ne demande que ce qui sert au livre ; le cadeau permet au destinataire de compléter lui-même.
- **Photos et souvenirs** :
  - stockage privé, chiffrement côté serveur ;
  - suppression des métadonnées de localisation (déjà fait pour les créatrices) ;
  - conservation configurable, par exemple 90 jours après livraison ;
  - suppression à la demande, et export des données.
- **Fournisseurs IA** : vérifier contractuellement la conservation et l'absence d'entraînement sur les données transmises (Anthropic, OpenAI). Aucune donnée client n'est utilisée pour entraîner un modèle.
- **Enfants** : pas de visage d'enfant envoyé aux fournisseurs d'images sans consentement explicite du parent ; préférence pour des illustrations non photoréalistes.
- **Plateforme** : limitation du débit (aperçus, questionnaire, connexion), journalisation sans données personnelles, webhooks vérifiés (déjà en place).

## 10. Arbitrages nécessaires

| # | Décision | Recommandation |
|---|---|---|
| A1 | Vitrine UNWRITTEN dans l'application boutique existante (arbre de routes séparé) ou application distincte | **Même application** : réutilisation complète des paiements, commandes, livraisons et de l'admin ; risque pour La Malle à Jeux maîtrisé par l'isolation et les tests |
| A2 | Compte Stripe unique ou par marque (dépend de l'entité juridique qui vend) | À décider avec votre comptable |
| A3 | Nom de domaine UNWRITTEN | À acheter par vous |
| A4 | Budget de génération des 3 livres de démonstration (dépense réelle) | Environ 5 à 15 $ d'API au total, d'après les estimations ci-dessus |
| A5 | Serveur worker plus puissant avant lancement (dépense réelle) | Oui, 4 à 8 Go de RAM |
| A6 | Vercel Pro avant lancement (dépense réelle) | Oui |
| A7 | Ordre d'ouverture des langues | Anglais et français d'abord, puis espagnol, allemand et italien |

## 11. Plan d'exécution

| Phase | Livrable | Contenu | Dépend d'un arbitrage |
|---|---|---|---|
| 0 | AUDIT_UNWRITTEN.md | Fait | — |
| 1 | ARCHITECTURE_UNWRITTEN.md | Ce document | A1 pour démarrer la phase 4 |
| 2 | DESIGN_SYSTEM_UNWRITTEN.md | Identité, polices, palette, composants, gabarits éditoriaux, couvertures | Non : **démarré** |
| 3 | GENERATION_ENGINE_UNWRITTEN.md | Formats, flux paginé, gabarits, bible visuelle, contrôle qualité, profils, échelonnement des modèles, pipeline par commande | Non pour le moteur ; A4 pour les démonstrations |
| 4 | STORE_UNWRITTEN.md | Marques, vitrine, questionnaire, aperçu, cadeau, bibliothèque, i18n | A1, A2, A3 |
| 5 | UNIT_ECONOMICS_UNWRITTEN.md | Coût par commande, tableau de bord, alertes | Non |
| 6 | QA_UNWRITTEN.md | Tests de bout en bout, 3 livres de démonstration, revue visuelle | A4 |
| 7 | LAUNCH_UNWRITTEN.md | Préproduction, SEO, marketing, ouverture des marchés | A5, A6, A7 |
