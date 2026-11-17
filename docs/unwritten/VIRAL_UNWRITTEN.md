# VIRAL_UNWRITTEN — Croissance virale et effet réseau

> Statut : **conception validée par la demande du 17 novembre 2026, développement à suivre**. Ce document complète `ARCHITECTURE_UNWRITTEN.md` (§ 15 du cahier des charges : partage, cadeaux, parrainage, affiliation, contenus promotionnels).
> Règle permanente : **un livre est privé par défaut**. Rien de personnel ne devient public sans consentement explicite, révocable, donné par la personne concernée.

## 1. Principe : chaque livre doit en faire naître d'autres

Un livre UNWRITTEN met toujours en jeu au moins deux personnes, celle qui offre et celle qui reçoit, et souvent toute une famille ou un groupe d'amis. On transforme chacune de ces personnes en **lecteur, contributeur ou futur acheteur**, sans jamais forcer le partage.

Les quatre boucles retenues, de la plus puissante à la plus classique :

| Boucle | Mécanisme | Pourquoi elle marche |
|---|---|---|
| **1. Livre collaboratif** | L'acheteur invite des proches à ajouter un souvenir, un message ou une photo avant la génération | Chaque contributeur découvre le produit de l'intérieur : c'est le meilleur aperçu possible |
| **2. Révélation du cadeau** | Le destinataire découvre son livre par une page de révélation animée, puis peut en offrir un à son tour | Émotion maximale au moment exact où l'envie d'offrir est la plus forte |
| **3. Le livre qui se transmet** | Défis à faire avec un tiers, QR « Passe le livre », cartes de partage des moments vécus | Le produit lui-même provoque le partage, sans publicité |
| **4. Parrainage et affiliation** | Lien personnel, avantage pour les deux, commission pour les créateurs de contenu | Récompense le bouche-à-oreille déjà provoqué par les boucles 1 à 3 |

## 2. Boucle 1 : livres collaboratifs (effet réseau)

- **Invitations** : l'acheteur ajoute des contributeurs, par lien à partager ou par e-mail. Chaque lien est **nominatif, signé et limité dans le temps**.
- **Contribution** : le contributeur répond à 1 à 3 questions courtes, sans créer de compte : un souvenir, un message, une photo facultative. Exemples :
  - « Ton plus beau souvenir avec Maman » ;
  - « Ce que tu n'as jamais osé lui dire ».
- **Modération par l'acheteur** : il voit chaque contribution et choisit de l'intégrer ou non. La génération attend la date limite ou son feu vert.
- **Cagnotte (phase ultérieure)** : plusieurs proches participent au paiement d'un même livre. Stripe le permet, mais la mise en œuvre est à valider : remboursements, parts inégales.
- **Après la génération** : chaque contributeur reçoit un **extrait de sa propre page**, jamais du livre entier sans l'accord de l'acheteur, avec une invitation à créer un livre pour quelqu'un d'autre.
- **Collections concernées** :
  - Before It's Too Late (« le livre des grands-parents écrit par toute la famille ») ;
  - The Movie of My Life (souvenirs des proches) ;
  - The Secret Book en version amis.

## 3. Boucle 2 : révélation du cadeau

- **Page de révélation** soignée : couverture qui s'ouvre, dédicace en premier, puis accès à la bibliothèque. Animation sobre (pas de confettis).
- **Mode surprise** : l'acheteur choisit la date et l'heure de l'envoi (anniversaire, Saint-Valentin, fête des mères) ; l'e-mail part à ce moment-là.
- **Après la révélation** :
  - un bouton « Remercier » envoie un message à l'offrant (sans révéler d'adresse) ;
  - un bouton « Offrir un livre à mon tour », avec l'avantage du parrainage de l'offrant.
- **Sans compte pour le destinataire** : il complète seulement ce qui est utile, conformément à l'architecture (option cadeau).

## 4. Boucle 3 : le livre qui se transmet

### The Secret Book
- Défis à vivre **à deux ou en groupe**, dont certains invitent à « recruter » un tiers : « offre ce défi à quelqu'un ».
- **Contenus débloquables par QR code**, conçus pour être vécus et racontés.
- **Dernière page « Passe le livre »** : QR code personnel menant à la création d'un livre pour un autre proche, avec l'avantage du parrainage.

### Before It's Too Late
- Chaque expérience vécue peut devenir une **carte souvenir à partager** : photo du client + phrase du livre, mise en page premium au format story (9:16) ou carré, avec une signature discrète « Écrit avec UNWRITTEN ».
- Ces cartes sont générées **à la demande du client**, à partir de ses propres photos, puis téléchargées par lui. **Aucune publication automatique.**

### The Movie of My Life
- **Bande-annonce du livre** : vidéo de 15 à 20 secondes, produite avec le module vidéo existant (Remotion). Elle montre la couverture qui s'anime, le titre, les noms des chapitres et une citation.
- **Version publique anonymisée par défaut** : prénoms remplacés par des initiales, aucune photo. La version complète n'est accessible qu'au client.
- **Affiche de film** du livre, imprimable, à offrir avec le PDF.

### Toutes collections
- **Extrait partageable** :
  - lien public vers 2 à 3 pages choisies par le client, avec filtre de confidentialité (prénoms masqués sauf accord) ;
  - lien révocable, avec expiration configurable ;
  - aperçu soigné pour les réseaux (image Open Graph générée à partir de la couverture, sans donnée privée).

## 5. Boucle 4 : parrainage, codes et affiliation

- **Parrainage client** :
  - chaque client reçoit un lien personnel ;
  - le filleul obtient une réduction, le parrain un crédit sur son prochain livre (montants configurables) ;
  - le crédit n'est acquis qu'après le délai de rétractation applicable et hors remboursement.
- **QR personnel imprimé dans le livre** : relié au parrainage, sans aucune donnée personnelle dans l'URL.
- **Affiliation** :
  - extension du module « créatrices » existant (commissions, paiements, export) aux créateurs de contenu et influenceurs ;
  - lien de suivi pendant 30 jours (dernier clic), tableau de bord, règles anti-fraude déjà en place (pas d'auto-achat, annulation au remboursement).
- **Cartes cadeaux** : montant ou livre précis, envoi programmé, utilisables sur toutes les collections de la marque.

## 6. Contenus promotionnels automatiques

À partir de chaque collection, et jamais à partir des livres des clients sans consentement :
- vidéo de présentation d'un livre exemple, animation de couverture, feuilletage numérique ;
- comparaison « avant / après personnalisation » réalisée avec un **personnage fictif** clairement présenté comme tel ;
- calendrier éditorial des temps forts (Saint-Valentin, fête des mères et des pères, fête des grands-mères, Noël, mariages).

Le module vidéo, les connecteurs Meta, Instagram et TikTok, et le suivi de rentabilité par produit existent déjà : on les réutilise.

## 7. Mesure (sans pistage abusif)

| Indicateur | Définition |
|---|---|
| Taux d'invitation | Part des commandes avec au moins un contributeur invité |
| Taux de contribution | Contributions reçues / invitations envoyées |
| Coefficient viral (K) | Nouvelles commandes issues d'invitations, de partages et de parrainages / commandes |
| Conversion par boucle | Ventes attribuées à chaque boucle (paramètre `ref` ou `utm`, déjà gérés par la boutique) |
| Coût d'acquisition organique | Crédits et réductions accordés / commandes générées |

La mesure respecte le consentement aux cookies existant ; l'attribution passe d'abord par les liens et les codes, pas par des traceurs tiers.

## 8. Confidentialité (non négociable)

- Livre, contributions et photos sont **privés par défaut**. Chaque partage est un choix explicite, **révocable**, avec un aperçu exact de ce qui sera visible.
- **Prénoms masqués par défaut** dans tout contenu public. Ni photo d'enfant ni donnée de tiers ne sont rendues publiques sans le consentement de la personne concernée, ou de ses parents pour un enfant.
- **Liens publics** : expiration configurable, jeton non devinable, aucune indexation (`noindex`), suppression à la demande.
- **Contributeurs** : ils sont informés de l'usage de leur contribution et peuvent la retirer avant la génération.
- **Aucune publication automatique** sur les réseaux du client.

## 9. Données et développement

**Nouveaux modèles (boutique)** :

| Modèle | Rôle |
|---|---|
| `ContributorInvite` | Invitation signée, nominative et expirante |
| `Contribution` | Contenu, statut (reçue, retenue, refusée), consentement |
| `ShareLink` | Pages exposées, masquage des prénoms, expiration, révocation |
| `Referral` | Code personnel, filleul, avantage, statut |
| `GiftCard` | Montant ou produit, date d'envoi programmée |
| `ScheduledDelivery` | Envoi programmé du cadeau |

**Studio** :
- génération des **QR codes** dans le PDF (petite bibliothèque libre de génération de QR, à justifier lors de l'ajout) ;
- **cartes de partage** (gabarits 9:16 et carré, rendus par Chromium comme les pages) ;
- **bande-annonce** (Remotion, module existant) ;
- intégration des contributions retenues dans le manuscrit, avec la mention « Écrit par … ».

**Ordre proposé** (après la première version de la boutique UNWRITTEN, en cours) :
1. Option cadeau avec envoi programmé et page de révélation.
2. Livre collaboratif (invitations et contributions).
3. Extraits partageables et QR « Passe le livre ».
4. Parrainage client.
5. Cartes souvenirs et bande-annonce.
6. Cartes cadeaux, affiliation influenceurs, cagnotte.

## 10. Transposable à La Malle à Jeux

Sans rien changer à l'existant, plusieurs idées s'appliquent aussi aux kits enfants :
- **diplôme partageable** (photo de l'enfant floutée par défaut) ;
- **QR « Invite un copain »** sur l'invitation d'anniversaire de la chasse au trésor : l'invitation imprimée devient un support d'acquisition auprès des autres parents ;
- **parrainage** entre parents.

À décider plus tard, une fois les boucles mesurées sur UNWRITTEN.
