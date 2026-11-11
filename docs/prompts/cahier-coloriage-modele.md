# Cahier de coloriage — modèle (120 dessins de dinosaures, 4–6 ans)

Type d'e-book du studio : **Cahier de coloriage** (`cahier-coloriage`), univers « Kit enfants » ou « Sciences enfants ».
Catégorie boutique : `activites-educatives` · gabarit `ACTIVITY` · une page A4 portrait par dessin.

Le plus simple : collez le **brief** ci-dessous dans « Créer depuis un brief » ou dans le pilote automatique. Le studio
rédige le sommaire puis les dessins par lots de 15 (aucune réponse tronquée), génère les 120 dessins au trait, la page
d'exemple colorée, la couverture en couleur, assemble le PDF et publie la fiche.

## 1. Brief (à coller dans le studio)

```
Cahier de coloriage de 120 dessins de dinosaures pour les 4 à 6 ans.
Dessins très simples au trait noir épais, contours fermés, un grand dinosaure par page, décor minimal.
Variété : tous les dinosaures connus des enfants (T-rex, tricératops, diplodocus, stégosaure, ptérodactyle…),
bébés dinosaures, œufs, volcans, fossiles, scènes rigolotes (dinosaure qui lit, qui joue au ballon, astronaute…).
Page « Ce cahier appartient à… », page d'exemple colorée, diplôme « Artiste en herbe ».
Prix 5,90 €.
```

## 2. Contenu en copier-coller (si le texte passe par votre abonnement Claude)

Au-delà de 20 dessins, le studio découpe la rédaction : **1 sommaire** (titres des 120 dessins) puis **8 lots** de 15
dessins. Chaque lot ne dépend que du sommaire : collez les réponses dans n'importe quel ordre (page « À coller », ou
toutes d'un coup avec « Tout coller en une fois »). C'est la solution la plus fiable : une seule réponse de 120 dessins
serait tronquée par Claude ou ChatGPT.

Prompt équivalent pour un essai manuel (petit volume) :

```
Écris le contenu complet du cahier de coloriage « Mon grand cahier de dinosaures » pour enfants de 4 à 6 ans,
PDF A4 portrait, une page par dessin : 20 dessins à colorier.
Complexité : très simple (3–5 ans) — un seul grand sujet centré, 5 à 12 grandes zones, contours très épais, aucun petit détail.
Chaque dessin : numero, titre court, description de la scène à dessiner (sujet, pose, expression, 1 à 3 éléments de décor,
sans couleur), legende courte ou "", niveau_detail "simple".
Ajoute une introduction (conseil papier 120 g pour les feutres), la page « Ce cahier appartient à », un diplôme
« Artiste en herbe » et 3 à 6 conseils aux parents. Aucun personnage sous licence, aucun texte dans les dessins.
Réponds uniquement avec ce JSON :
{ "titre": "…", "sous_titre": "…", "theme": "Dinosaures", "introduction": "…",
  "dessins": [ { "numero": 1, "titre": "…", "description": "…", "legende": "", "niveau_detail": "simple" } ],
  "page_appartient": { "titre": "Ce cahier appartient à", "texte": "…" },
  "diplome": { "titre": "Diplôme d'artiste en herbe", "texte": "…" },
  "conseils": ["…"],
  "illustrations": [ { "page": "couverture", "prompt": "… couverture EN COULEUR …" } ],
  "boutique": { "name": "…", "shortDescription": "…", "tags": ["coloriage", "dinosaures"], "faq": [ { "question": "…", "answer": "…" } ] } }
```

## 3. Images

### Sans aucune intervention : par l'API (recommandé)

Réglages par défaut du type (Paramètres → IA → Cahiers de coloriage, modifiables dans le plan) :
`gpt-image-1-mini`, qualité `medium`, portrait, **sans esquisse** (une esquisse coûterait presque autant qu'un dessin au
trait final) ; couverture en `gpt-image-1` qualité `high`.
Ordre de grandeur pour 120 dessins : ≈ 123 images × 0,017 $ + couverture 0,17 $ ≈ **2,20 $** (estimation affichée avant
lancement). Mode mixte possible dans le plan : « Texte : copier-coller (abonnement Claude) · Images : API OpenAI ».

### Copier-coller « en lot » dans ChatGPT (0 $ d'API)

Le studio crée **une seule** demande « Lot d'images » avec un prompt maître : règles de style communes puis la liste des
planches. Une planche = **4 dessins en grille 2×2** (portrait 1024×1536, gouttières blanches larges) → 120 dessins =
30 planches (option 1 dessin ou 3×3 ; 3×3 déconseillé pour les 3–5 ans).
ChatGPT s'arrête régulièrement (limites par message et par période selon l'abonnement) : écrivez « continue ».
Déposez ensuite toutes les planches d'un coup (ou un ZIP) : découpage automatique, noir et blanc pur, vectorisation du
trait, écran de vérification (permuter, rejeter, régler la découpe), puis « Valider » : la production reprend seule.

## 4. Style (charte « coloriage », éditable dans Paramètres → Univers)

Trait noir pur sur blanc pur, contours fermés, aucun gris, aucune ombre, aucun remplissage, aucun texte, aucun cadre.
Le studio contrôle chaque dessin (sharp) et le convertit en noir et blanc par seuillage si besoin, sans regénération.
