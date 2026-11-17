# PRINT_UNWRITTEN — Option « version imprimée livrée chez vous »

> Statut : **option validée par le client le 17 novembre 2026, conception, développement à suivre** (après la première version de la boutique UNWRITTEN).
> Aucune commande d'essai payante n'est passée sans accord explicite.

## 1. Principe

Au moment de commander un livre personnalisé, le client peut ajouter **une édition imprimée**, livrée chez lui ou chez la personne à qui il l'offre. Le PDF numérique reste toujours livré : l'imprimé est un supplément.

Le livre est imprimé **à l'unité, à la demande**, par un imprimeur partenaire relié par API. Nous n'avons ni stock ni expédition à gérer.

## 2. Parcours

1. **Fiche produit et questionnaire** : choix « Numérique » ou « Numérique + imprimé » (format et finition proposés selon la collection, par exemple A5 couverture souple, ou 21 × 21 cm couverture rigide pour The Movie of My Life).
2. **Paiement** :
   - Stripe Checkout collecte l'adresse de livraison et applique les **frais de port par pays** ;
   - l'imprimé et le port sont des lignes distinctes de la commande ;
   - livraison possible chez le destinataire du cadeau.
3. **Production du livre** : pipeline habituel. Le contrôle qualité doit être réussi avant toute impression ; un défaut critique bloque l'envoi à l'imprimeur.
4. **Validation client facultative** : une dernière relecture de l'aperçu avant impression, vivement conseillée pour The Movie of My Life. Une fois l'impression lancée, plus de modification.
5. **Fichiers d'impression** :
   - le studio produit l'intérieur et la couverture **selon les spécifications de l'imprimeur choisi** : fond perdu, marges de sécurité, couverture en planche avec dos dont l'épaisseur dépend du nombre de pages et du papier ;
   - il les vérifie, si possible par l'API de validation de l'imprimeur.
6. **Commande à l'imprimeur** par API, puis suivi par webhooks (en production, expédiée, livrée) et e-mail au client avec le numéro de suivi.
7. **Incidents** : livre abîmé ou défaut d'impression, réimpression demandée à l'imprimeur selon ses conditions ; adresse erronée, procédure dédiée dans l'admin.

## 3. Imprimeurs avec API (présélection à vérifier)

Informations relevées le 17 novembre 2026 sur les sites des fournisseurs et des articles. **Elles doivent être confirmées sur leur documentation officielle avant tout choix ; les prix n'y figurent pas.**

| Service | Ce qui a été relevé | Intérêt pour UNWRITTEN |
|---|---|---|
| **Lulu Print API** | Documentation sur api.lulu.com/docs ; environnement de test (sandbox) sans impression ni facturation ; pas de frais d'utilisation de l'API, seuls les livres imprimés sont facturés ; une impression = un PDF de couverture + un PDF d'intérieur ; page dédiée aux livres personnalisés | Très adapté aux livres personnalisés à l'unité ; test gratuit |
| **Gelato** | API de commandes (v4, clé dans l'en-tête `X-API-KEY`), webhooks d'état ; livres photo acceptés en PDF multipage ; offre « livres pour enfants personnalisés » ; réseau d'imprimeurs dans de nombreux pays (chiffres variables selon les sources) | Impression proche du client, intéressant pour l'international |
| **Peecho** | API d'impression sans frais d'inscription ni d'abonnement ; livres et magazines ; délai annoncé de 2 à 5 jours ouvrés en Europe de l'Ouest hors pic ; appartiendrait au groupe Prodigi (selon un site tiers) | Bon candidat européen pour les livres et magazines |
| **Cloudprinter** | API d'impression orientée éditeurs ; impression locale dans de nombreux pays (chiffres de l'entreprise) ; titres identifiés par ISBN | Moins adapté a priori aux livres uniques sans ISBN, à vérifier |

**Recommandation** : comparer **Lulu** et **Gelato** en premier.
- **Lulu** : sandbox gratuit, et spécialité des livres personnalisés.
- **Gelato** : impression locale, utile pour l'anglais et le français à l'international.
- **Méthode** : intégration sous forme d'un connecteur interchangeable (`PrintProvider`), comme pour les fournisseurs d'IA, afin de pouvoir changer d'imprimeur ou en utiliser deux selon le pays.

## 4. Prix et marge

- **Prix de vente imprimé** : configurable par collection, format et finition dans l'admin.
- **Coût réel** : obtenu auprès de l'imprimeur (calcul de prix par API s'il existe, sinon grille tarifaire saisie dans l'admin) et enregistré **par commande** dans le suivi des coûts (`UNIT_ECONOMICS_UNWRITTEN.md`). La marge contributive inclut l'impression, le port et les frais Stripe.
- **Garde-fou** : le prix affiché au client ne doit jamais être inférieur au coût connu + marge minimale ; sinon l'option est masquée pour ce pays ou ce format.

## 5. Exigences techniques côté studio

- **Exports** : un export « impression » par imprimeur (profil de spécifications : format, fond perdu, marges, couverture en planche, épaisseur du dos, résolution minimale des images, polices incorporées).
- **Gabarit de couverture** : ses dimensions sont calculées à partir du nombre de pages.
- **Contrôles bloquants** : résolution des images à la taille imprimée, textes hors zone de sécurité, nombre de pages compatible avec la reliure.
- **Couleurs** : le studio produit aujourd'hui des PDF en couleurs d'écran (RVB). La conversion CMJN et le profil colorimétrique seront ceux demandés par l'imprimeur. **Une épreuve physique de chaque collection est indispensable avant l'ouverture de l'option.**

## 6. Juridique et service client (à valider par un professionnel)

- Le droit de rétractation ne s'appliquerait pas aux biens « nettement personnalisés » : **à confirmer par votre juriste**, et à indiquer clairement avant le paiement.
- Mentions obligatoires sur les délais de livraison, les pays desservis, les droits de douane hors Union européenne.
- Données de livraison transmises à l'imprimeur : prévoir la mention dans la politique de confidentialité et vérifier son contrat de traitement des données.

## 7. Étapes

1. Vérifier la documentation officielle de Lulu et de Gelato (formats, finitions, pays, délais, validation des fichiers, webhooks, conditions).
2. Intégrer le connecteur Lulu en **sandbox** (sans frais), produire des fichiers conformes pour les trois collections.
3. **Avec votre accord** : commander une épreuve physique par collection, réelle et payante, puis ajuster les gabarits.
4. Ouvrir l'option en France, puis étendre selon les pays desservis et les coûts réels.

## Sources consultées
- Lulu : https://www.lulu.com/sell/sell-on-your-site/print-api · https://www.lulu.com/personalized-books · https://assets.lulu.com/media/guides/en/lulu-api-getting-started-guide.pdf
- Gelato : https://developers.gelato.com/docs/get-started · https://connect-support.gelato.com/en/articles/11075645-order-management-api-documentation · https://www.gelato.com/au/products/childrens-books
- Peecho : https://www.peecho.com/print-api · https://europeanpurpose.com/tool/peecho · https://help.flipsnack.com/en/articles/3737901-introduction-to-printing-with-peecho
- Cloudprinter : https://www.cloudprinter.com/print-api-solutions-for-the-publishing-industry · https://apps.shopify.com/cloudprinter-com?locale=nb
