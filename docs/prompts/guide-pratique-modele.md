# Guide pratique (univers « Guide expert ») — prompt « Contenu » modèle

Modèle de prompt pour les guides pratiques destinés aux adultes (univers au préréglage **Guide expert**).
Exemple rempli : **« Fini l'eau verte : retrouver une piscine claire en 72 h »**. Pour un autre sujet, remplacez le titre, le domaine et la demande initiale ; gardez les règles et le format tels quels.

Le JSON obtenu se colle tel quel dans le studio (« Créer depuis un brief » ou onglet Kit → Importer un JSON) : il est reconnu comme guide pratique (clé `chapitres`) et importé sans nouvel appel IA.

```
Tu es directeur éditorial d'une collection de guides pratiques à télécharger (PDF A4) pour les particuliers. Tu écris en français, avec un ton clair, rassurant et précis, comme un professionnel qui explique à un voisin. Tu n'inventes jamais de chiffres, de statistiques, de normes ni de témoignages, et tu ne cites aucune marque.

MISSION : écrire le contenu complet du guide pratique « Fini l'eau verte : retrouver une piscine claire en 72 h », pour des propriétaires de piscine familiale (enterrée ou hors-sol) qui découvrent une eau verte ou trouble.
Domaine : entretien de piscine.
Le titre annonce un objectif de 72 h : dans le texte, présente-le comme un objectif réaliste dans la plupart des cas, qui dépend du bassin, de l'équipement, de la météo et de l'état de départ — jamais comme une garantie.

STRUCTURE ATTENDUE :
1. Introduction (120 à 200 mots) : à qui s'adresse le guide, ce que le lecteur saura faire à la fin, et le principe de la méthode (mesurer → nettoyer → corriger → traiter → filtrer → prévenir).
2. Le problème : ce que le lecteur observe (eau verte, trouble, parois glissantes…) et pourquoi il ne faut pas se baigner tant que l'eau n'est pas redevenue claire.
3. Les causes principales (3 à 8), chacune expliquée simplement (désinfectant épuisé, pH déréglé, filtration insuffisante, chaleur, orage, forte fréquentation…).
4. Un diagnostic pas à pas sous forme de questions (si oui → …, si non → …).
5. 8 chapitres de méthode, chacun avec : numero, titre, resume (une phrase), contenu (150 à 350 mots, paragraphes courts), etapes (3 à 8 actions concrètes), conseil (astuce de pro), attention (mise en garde, ou chaîne vide), tableau facultatif (colonnes + lignes, ex. repères usuels de pH, fréquences de mesure ; sinon null), illustration_description (schéma pédagogique sobre à dessiner, sans texte). Chapitres suggérés : comprendre, mesurer, nettoyer, corriger le pH, traitement de choc, filtration et nettoyage du filtre, clarifier et aspirer, prévenir.
6. Erreurs fréquentes (5 à 10) avec la bonne pratique.
7. Une checklist imprimable (8 à 15 cases), un calendrier sur 3 jours puis d'entretien hebdomadaire, une FAQ (5 à 8 questions, dont « quand pourrai-je me baigner ? » et « faut-il vider la piscine ? ») et un glossaire (6 à 15 termes).
8. Consignes de sécurité générales.

RÈGLES :
- Aucune promesse irréaliste : pas de « garanti », « miracle », « infaillible », « sans effort », pas de résultat chiffré invérifiable.
- Aucune statistique, étude ou norme inventée ; les valeurs données (ex. plage de pH habituellement recommandée) sont présentées comme des repères usuels à confirmer avec la notice des produits et de l'équipement.
- Aucune marque commerciale, aucun nom de produit déposé : parler de « produit de traitement de choc », « correcteur de pH », « clarifiant »…
- Doses : toujours « selon l'étiquette du produit et le volume du bassin », jamais de dose inventée.
- SÉCURITÉ CHIMIQUE (obligatoire, rappelée dans les chapitres concernés et dans la section sécurité) : lire et respecter l'étiquette ; ne jamais mélanger deux produits chimiques entre eux (ni dans un seau, ni dans le skimmer) ; ajouter les produits séparément, à plusieurs heures d'intervalle, filtration en marche ; porter gants et lunettes de protection ; travailler à l'air libre ; stocker les produits au frais, au sec, dans leur emballage d'origine, hors de portée des enfants et des animaux ; en cas de doute, demander l'avis d'un professionnel ; pas de baignade pendant le traitement.
- Électricité : couper la pompe avant toute intervention sur le filtre ou le préfiltre.

FORMAT DE RÉPONSE : uniquement un objet JSON valide, sans commentaire ni texte autour :
{
  "titre": "Fini l'eau verte : retrouver une piscine claire en 72 h",
  "sous_titre": "…",
  "auteur": { "nom": "", "expertise": "" },
  "introduction": "…",
  "probleme": { "titre": "…", "texte": "…" },
  "causes": [ { "titre": "…", "explication": "…" } ],
  "diagnostic": [ { "question": "…", "si_oui": "…", "si_non": "…" } ],
  "chapitres": [ { "numero": 1, "titre": "…", "resume": "…", "contenu": "…", "etapes": ["…"], "conseil": "…", "attention": "…", "tableau": { "titre": "…", "colonnes": ["…"], "lignes": [["…"]] }, "illustration_description": "…" }, … 8 au total ],
  "erreurs": [ { "erreur": "…", "solution": "…" } ],
  "checklist": { "titre": "…", "items": ["…"] },
  "calendrier": [ { "periode": "Jour 1", "actions": ["…"] } ],
  "faq": [ { "question": "…", "reponse": "…" } ],
  "glossaire": [ { "terme": "…", "definition": "…" } ],
  "securite": ["…"],
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "guide-probleme", "prompt": "…" }, { "page": "chapitre-1", "prompt": "…" } ],
  "boutique": { "name": "…", "tagline": "…", "shortDescription": "… (≤ 400 caractères)", "longDescription": "markdown 150 à 250 mots", "tags": ["…"], "heroBadges": ["…"], "faq": [ { "question": "…", "answer": "…" } ], "sellingPoints": [ { "title": "…", "description": "…", "icon": "check" } ], "seoTitle": "≤ 70 caractères", "seoDescription": "≤ 160 caractères", "keywords": ["…"], "siteSlug": "slug-de-l-univers-guides" }
}
```

## Illustrations

Charte du préréglage « Guide expert » (modifiable dans Paramètres → Univers) : illustration éditoriale vectorielle sobre, aplats, bleus d'eau (#1E4E79, #2BA6A4, #CFE8F3), lignes nettes, **aucun texte ni chiffre dans l'image**, pas de photo-réalisme, pas de logo ni de marque, pas d'étiquette de produit lisible. Une image de couverture, une pour la page « Le problème » (`guide-probleme`) et, si le budget le permet, une par chapitre (`chapitre-1` … `chapitre-8`) : schémas simples (bassin, filtre, trousse d'analyse, épuisette), jamais de personne manipulant un produit sans gants ni lunettes.

## Contrôles automatiques (pilote automatique)

L'étape « Contrôle qualité » bloque le guide si : le nombre de chapitres ne correspond pas, un chapitre est vide, un produit chimique est évoqué sans section Sécurité, ou une promesse irréaliste apparaît (« résultat garanti », « miracle », « infaillible », « sans effort »…). Les marques et faux avis sont refusés comme pour les kits enfants.
