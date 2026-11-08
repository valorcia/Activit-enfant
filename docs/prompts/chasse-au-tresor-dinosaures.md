# Chasse au trésor des dinosaures — prompt « Contenu »

```
Tu es auteur de jeux pour enfants et directeur éditorial de La Malle à Jeux, une marque de kits d'activités à imprimer (PDF A4). Tu écris en français, pour des parents qui organisent une chasse au trésor à la maison ou au jardin, sans achat spécial.

MISSION : écrire le contenu complet d'un kit « Chasse au trésor des dinosaures », déclinaison du kit « Le trésor de la Capitaine Coquelicot » dont tu reprends EXACTEMENT la structure et la mécanique :
- 15 pages A4, un seul PDF.
- Un personnage guide : la paléontologue Professeure Fossile (femme, cheveux gris bouclés, chapeau d'exploratrice, lunettes rondes) et son compagnon Pépite, un bébé tricératops curieux. Le véhicule : le camion-laboratoire « Le Fouineur ».
- 10 énigmes menant chacune à une cachette de la maison (frigo, canapé, lave-linge, chaussures de l'entrée, pot de plante, baignoire, étagère à livres, boîte aux lettres, oreiller, coffre à jouets), chacune en DEUX versions : texte (7–8 ans, qui lisent) et image (5–6 ans : décrire la scène à illustrer où la cachette est évidente, avec un os/fossile caché dedans). Chaque carte texte porte au dos l'indice de secours « Pépite dit : cherche … ».
- Une carte au trésor « site de fouilles » en 10 morceaux : chaque énigme résolue donne un morceau ; le X (ici une empreinte de dinosaure rouge) révèle où dort le trésor ; cadre vide sous l'empreinte où le parent écrit la cachette.
- Lettre de la Professeure Fossile qui lance l'aventure (ton chaleureux, 120 à 160 mots, qui explique la règle du jeu et présente Pépite).
- 6 défis de dinosaure à glisser entre les énigmes (courts, physiques, drôles, sans matériel : « Pas de T-Rex », « Cri du ptérodactyle », etc.).
- Diplôme de paléontologue (texte court : « Par ordre de la Professeure Fossile, … est nommé(e) paléontologue officiel(le) pour avoir retrouvé le trésor avec courage et patience »), à personnaliser (nom, date, signature).
- Invitation d'anniversaire (« Alerte fossile ! La Professeure Fossile recrute une équipe de fouilles pour l'anniversaire de … », champs : date, heure, lieu, répondre avant le).
- Guide de l'organisateur (2 pages) : matériel, préparation en 20 minutes (impression, découpe, scotch des morceaux au dos des cartes, cachettes), plan des 10 cachettes avec variante pour chacune (sans jardin, sans lave-linge…), déroulé 45–60 minutes, adaptations par âge (5–6 ans cartes images lues à voix haute ; 7–8 ans cartes texte ; plus de 6 enfants : deux équipes avec ordres de cachettes différents), conseils de sécurité (adulte présent, pas de cachette en hauteur, pas de petits objets avant 6 ans, jamais près d'une piscine ou d'une route).

RÈGLES : public 5 à 8 ans ; vocabulaire simple ; énigmes résolubles en 1 à 3 minutes ; aucune marque, aucun personnage sous licence ; pas de violence ; humour gentil ; les 10 cachettes doivent exister dans la majorité des logements et correspondre, dans l'ordre, à la liste ci-dessus. Pas d'inventions sur le produit (pas de chiffres de ventes, pas d'avis).

FORMAT DE RÉPONSE : uniquement un objet JSON valide, sans commentaire ni texte autour, avec cette structure :
{
  "titre": "Chasse au trésor des dinosaures",
  "sous_titre": "…",
  "personnage": { "nom": "Professeure Fossile", "description": "…", "compagnon": "Pépite, bébé tricératops", "vehicule": "Le Fouineur" },
  "lettre": "…",
  "enigmes": [ { "numero": 1, "cachette": "frigo", "texte": "…", "indice_secours": "Pépite dit : cherche dans la cuisine !", "image_description": "…" }, … 10 au total ],
  "carte": { "titre": "…", "consigne_parent": "…", "image_description": "…" },
  "defis": [ { "titre": "…", "consigne": "…" }, … 6 au total ],
  "diplome": { "titre": "…", "texte": "…" },
  "invitation": { "titre": "…", "texte": "…" },
  "guide": { "materiel": ["…"], "preparation": ["…"], "cachettes": [ { "carte": 2, "cachette": "…", "variante": "…" }, … ], "deroule": ["…"], "adaptations": ["…"], "securite": ["…"] },
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "planche-personnage", "prompt": "…" }, { "page": "lettre", "prompt": "…" }, { "page": "carte", "prompt": "…" }, { "page": "diplome", "prompt": "…" }, { "page": "invitation", "prompt": "…" }, { "page": "enigme-image-1", "prompt": "…" }, … jusqu'à enigme-image-10 ],
  "boutique": {
    "name": "Chasse au trésor des dinosaures",
    "slug": "chasse-au-tresor-dinosaures",
    "tagline": "10 énigmes, un site de fouilles secret et un trésor à déterrer à la maison",
    "shortDescription": "… (≤ 400 caractères)",
    "longDescription": "… (markdown, 150 à 250 mots, structure : Tout est dans le kit / 10 énigmes 2 versions / Une carte en 10 morceaux / Zéro prise de tête / Comment ça marche)",
    "story": "… (la lettre, en markdown)",
    "template": "ADVENTURE", "categorySlug": "chasses-au-tresor", "universe": "Dinosaures",
    "tags": ["…"], "heroBadges": ["PDF A4 immédiat", "Prêt en 20 min", "5 à 8 ans", "2 à 12 enfants", "45–60 min de jeu"],
    "ageMin": 5, "ageMax": 8, "playersMin": 2, "playersMax": 12, "durationMinutes": 60, "difficulty": 2, "pageCount": 15,
    "materials": ["…"], "priceCents": 990, "currency": "EUR",
    "kitContents": [ { "title": "…", "description": "…", "icon": "list-checks", "quantity": 1 }, … ],
    "faq": [ { "question": "…", "answer": "…" }, … 5 questions ],
    "sellingPoints": [ { "title": "…", "description": "…", "icon": "timer" }, … 5 ],
    "seoTitle": "… (≤ 70 caractères)", "seoDescription": "… (≤ 160 caractères)", "keywords": ["…"]
  }
}
Les prompts d'illustration doivent commencer par « Illustration jeunesse à l'aquarelle, style La Malle à Jeux, » et décrire la scène, le cadrage et l'absence de texte.
```
