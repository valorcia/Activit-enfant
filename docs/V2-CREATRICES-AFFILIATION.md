# V2 — Espace créatrices et affiliation (idée d'Angélique)

> Statut : **idée validée, à démarrer plus tard**. Ce document garde la proposition complète pour le jour du lancement.
> Rien n'est encore développé. Les décisions à prendre sont listées en fin de document.

## L'idée

Des parents (des mamans, des papas, des assistantes maternelles…) ont des idées d'activités simples et ludiques à faire avec les enfants. Exemple : Marie a fabriqué avec son fils un petit hérisson dans une bulle en verre.

Elles proposent leur idée sur la boutique, avec leurs photos et leurs astuces. Le studio la transforme en **petit tutoriel illustré**, vendu peu cher (2,90 € à 4,90 €). À **chaque vente**, la créatrice touche une **commission**.

Deux mécanismes complémentaires :

1. **Redevance sur ses propres tutoriels** (le cœur du projet) : une part de chaque vente de ses e-books.
2. **Affiliation** (en option, phase 2) : un lien personnel qui lui rapporte une commission sur tout achat qu'elle fait venir, même d'autres produits.

## Le parcours

1. **Inscription** dans un « Espace créatrice » sur la boutique : compte, acceptation du contrat, coordonnées de paiement.
2. **Proposition d'une idée** par un formulaire simple : titre, âge, durée, matériel, étapes, astuces, 3 à 10 photos de sa réalisation.
3. **Validation par l'équipe** (file de modération dans l'admin) : originalité, sécurité pour les enfants (verre, colle chaude, petites pièces…), qualité des photos. Réponses possibles : accepter, refuser, demander une modification.
4. **Fabrication automatique** : la proposition devient le brief du pilote automatique (rédaction, illustrations dans le style La Malle à Jeux, mise en page). Ses photos servent de référence et peuvent apparaître dans le livre (« la réalisation de Marie »).
5. **Validation par la créatrice** : elle reçoit l'aperçu et confirme avant la mise en vente.
6. **Mise en vente** : fiche produit « Une idée de Marie » et page créatrice publique avec tous ses tutoriels.
7. **Suivi** : chaque vente crée automatiquement une ligne de commission ; tableau de bord (ventes, commissions, paiements).
8. **Paiement mensuel**, au-delà d'un minimum (par exemple 20 €).

## Rémunération proposée

Base de calcul : **le montant réellement encaissé** = prix HT − frais Stripe − remboursements. (Un pourcentage du TTC ferait perdre de l'argent sur les petits prix.)

| Apport de la créatrice | Commission conseillée |
|---|---|
| Idée + quelques photos (le studio fait tout le reste) | 20 à 25 % |
| Tutoriel complet avec ses propres photos des étapes | 35 à 50 % |
| Exclusivité accordée à La Malle à Jeux | + 5 points (à décider) |

Exemple — tutoriel vendu **3,90 € TTC** :
- prix HT ≈ 3,25 € ;
- frais Stripe ≈ 0,30 € → encaissé ≈ 2,95 € ;
- à 25 % : **≈ 0,74 € par vente** pour la créatrice.

**Packs** : si son tutoriel fait partie d'un pack, elle touche sa part au prorata du prix des produits du pack.

**Affiliation (phase 2)** : lien personnel `https://www.lamalleajeux.eu/?ref=marie`, commission par exemple de **10 %** sur tout achat effectué via ce lien dans les **30 jours** (dernier clic). Intérêt : elle fait connaître la boutique sur Instagram, Facebook, dans les groupes de parents.

## Règles de protection

- **Commission confirmée après le délai de remboursement** (par exemple 14 jours) ; un remboursement annule la commission.
- **Anti-fraude** : pas de commission sur ses propres achats (même e-mail, même carte, même adresse) ; pas de cumul redevance + affiliation sur une même vente (on garde le plus élevé) ; codes promo diffusés sans accord exclus.
- **Contrat accepté en ligne** (version enregistrée avec date et adresse IP) :
  - elle garantit que l'idée et les photos sont les siennes ;
  - elle autorise la vente, l'adaptation (texte réécrit, illustrations) et la promotion du contenu ;
  - exclusivité ou non, durée, conditions de retrait du catalogue.
- **Photos d'enfants** : pas de visage reconnaissable, ou autorisation écrite des deux parents. Recommandation : « mains et réalisation uniquement ».
- **Sécurité des activités** : toute activité à risque (verre, chaleur, outils, petites pièces avant 3 ans) porte la mention « avec un adulte » et les consignes de sécurité types.

## Paiements et obligations

- **Phase test** : virement manuel mensuel à partir d'un export des commissions (CSV).
- **Ensuite** : **Stripe Connect** (comptes « Express ») — Stripe vérifie l'identité, conserve l'IBAN et verse automatiquement. Nous ne manipulons jamais les coordonnées bancaires.
- **Déclaration DAC7** : une plateforme qui fait vendre des particuliers doit déclarer chaque année leurs revenus à l'administration fiscale (exemption pour les petits vendeurs, sous environ 30 ventes et 2 000 € par an — **à faire confirmer par le comptable**). Il faut donc collecter l'identité des créatrices (Stripe Connect facilite cette collecte).
- **Statut des créatrices** (particulier, micro-entrepreneur, rémunération en droits d'auteur…) : a des conséquences sur nos propres déclarations. **À valider avec l'expert-comptable avant le lancement.**

## Ce qu'il faudra développer

Déjà en place : produits et paiements Stripe, pilote automatique (brief → e-book), suivi des ventes par produit et par lien (UTM), statistiques, multi-univers, liens studio ↔ boutique.

À ajouter :

**Boutique — modèle de données**
- `Creator` : identité, pseudo public, bio, photo, statut (invitée, active, suspendue), version du contrat acceptée, compte Stripe Connect, taux par défaut.
- `CreatorSubmission` : idée proposée (champs du formulaire, photos, âge, sécurité), statut (brouillon, envoyée, à modifier, acceptée, refusée), commentaires de modération, livre du studio lié.
- `Product.creatorId` + taux de redevance propre au produit (surcharge du taux par défaut).
- `CommissionEntry` : commande, produit, créatrice, base de calcul, taux, montant, statut (en attente, confirmée, annulée, payée), type (redevance ou affiliation).
- `Payout` : période, total, statut, référence du virement ou du transfert Stripe.
- `ReferralClick` / cookie `ref` : code d'affiliation, date, conversion.

**Boutique — écrans**
- Espace créatrice : inscription, contrat, nouvelle idée, suivi des propositions, aperçu à valider, tableau de bord des ventes et commissions, paiements, lien d'affiliation.
- Pages publiques : page créatrice, mention « Une idée de … » sur la fiche produit.
- Admin : file de modération, taux de commission, commissions à confirmer, paiements du mois, export comptable et DAC7.

**Boutique — logique**
- Création des lignes de commission dans le webhook Stripe (paiement confirmé), annulation au remboursement, confirmation automatique après le délai.
- Lecture du cookie `ref` au paiement pour l'affiliation.

**Studio**
- Bouton « Créer l'e-book depuis cette proposition » : brief pré-rempli depuis la proposition, photos de la créatrice comme références d'illustration, crédit « Une idée de … » dans le livre.
- Envoi de l'aperçu à la créatrice pour validation (lien d'aperçu partagé, déjà disponible).

## Déploiement proposé

| Phase | Contenu | Durée indicative |
|---|---|---|
| 1 — Test | Sur invitation (5 à 10 créatrices, dont Angélique) : proposition, modération, fabrication, redevance, virement manuel | ≈ 2 semaines de développement |
| 2 — Automatisation | Stripe Connect, liens d'affiliation, pages créatrices publiques, export DAC7 | ≈ 2 à 3 semaines |
| 3 — Ouverture | Inscriptions libres, badges (« Créatrice du mois »), concours d'idées saisonniers (Noël, Pâques, vacances) | selon les résultats |

Critère pour passer à la phase 2 : les tutoriels des créatrices se vendent (au moins quelques ventes par tutoriel et par mois) et la modération reste gérable.

## Décisions à prendre avant de démarrer

1. **Taux de commission** — recommandation : 25 % (idée seule), 40 % (tutoriel complet).
2. **Exclusivité** exigée, facultative (avec bonus) ou non.
3. **Prix de vente cible** des tutoriels (2,90 € ? 3,90 € ? 4,90 €).
4. **Statut proposé aux créatrices** et traitement fiscal — avec l'expert-comptable.
5. **Affiliation** dès la phase 1 ou seulement en phase 2.
6. **Seuil et fréquence de paiement** (par exemple 20 €, mensuel).

Pour lancer : « On démarre la V2 créatrices », avec les réponses aux six points ci-dessus.
