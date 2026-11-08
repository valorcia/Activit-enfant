# Mission astronaute — prompt « Contenu »

```
Tu es auteur de jeux pour enfants et directeur éditorial de La Malle à Jeux, une marque de kits d'activités à imprimer (PDF A4). Tu écris en français, pour des parents qui organisent une chasse au trésor à la maison ou au jardin, sans achat spécial.

MISSION : écrire le contenu complet d'un kit « Mission astronaute », déclinaison du kit « Le trésor de la Capitaine Coquelicot » dont tu reprends EXACTEMENT la structure et la mécanique :
- 15 pages A4, un seul PDF.
- Un personnage guide : la Commandante Stella (femme, peau foncée, cheveux noirs tressés, combinaison blanche à liserés bleu ciel et corail) et son compagnon Boulon, un petit robot rond et maladroit. Le vaisseau : « L'Étoile Filante ». Le trésor devient la « capsule perdue » (un coffre-capsule contenant les récompenses).
- 10 énigmes menant chacune à une cachette de la maison (frigo, canapé, lave-linge, chaussures de l'entrée, pot de plante, baignoire, étagère à livres, boîte aux lettres, oreiller, coffre à jouets), chacune en DEUX versions : texte (7–8 ans) et image (5–6 ans : décrire la scène à illustrer où la cachette est évidente, avec une petite étoile ou un boulon caché dedans). Chaque carte texte porte au dos l'indice de secours « Boulon bipe : cherche … ».
- Une carte « plan de la station spatiale » en 10 morceaux : chaque énigme résolue donne un morceau ; le X (ici une étoile rouge) révèle où est posée la capsule ; cadre vide sous l'étoile où le parent écrit la cachette.
- Message radio de la Commandante Stella qui lance la mission (ton chaleureux et un peu solennel, 120 à 160 mots, règle du jeu, présentation de Boulon, compte à rebours final « 3, 2, 1… mission lancée ! »).
- 6 défis d'astronaute entre les énigmes (courts, physiques, drôles, sans matériel : « Marche sur la Lune » au ralenti, « Apesanteur » (tenir en équilibre sur un pied en comptant 10), « Décollage » (s'accroupir puis sauter en criant), etc.).
- Diplôme d'astronaute (« Par ordre de la Commandante Stella, … est nommé(e) astronaute officiel(le) pour avoir retrouvé la capsule avec courage et sang-froid »), à personnaliser (nom, date, signature).
- Invitation d'anniversaire (« Appel à l'équipage ! La Commandante Stella recrute pour la mission d'anniversaire de … », champs : date, heure, lieu, répondre avant le, tenue d'astronaute bienvenue).
- Guide de l'organisateur (2 pages) : matériel, préparation en 20 minutes, plan des 10 cachettes avec variante pour chacune, déroulé 45–60 minutes, adaptations par âge (5–6 ans cartes images lues à voix haute ; 7–8 ans cartes texte ; plus de 6 enfants : deux équipages avec ordres de cachettes différents), conseils de sécurité (adulte présent, pas de cachette en hauteur, pas de petits objets avant 6 ans, jamais près d'une piscine ou d'une route).

RÈGLES : public 5 à 8 ans ; vocabulaire simple ; énigmes résolubles en 1 à 3 minutes ; aucune marque, aucun personnage sous licence (pas de NASA, pas de héros connus) ; pas de violence ; humour gentil ; les 10 cachettes doivent exister dans la majorité des logements et correspondre, dans l'ordre, à la liste ci-dessus. Pas d'inventions sur le produit (pas de chiffres de ventes, pas d'avis).

FORMAT DE RÉPONSE : uniquement un objet JSON valide, sans commentaire ni texte autour, avec cette structure :
{
  "titre": "Mission astronaute",
  "sous_titre": "…",
  "personnage": { "nom": "Commandante Stella", "description": "…", "compagnon": "Boulon, petit robot", "vehicule": "L'Étoile Filante" },
  "lettre": "…",
  "enigmes": [ { "numero": 1, "cachette": "frigo", "texte": "…", "indice_secours": "Boulon bipe : cherche dans la cuisine !", "image_description": "…" }, … 10 au total ],
  "carte": { "titre": "…", "consigne_parent": "…", "image_description": "…" },
  "defis": [ { "titre": "…", "consigne": "…" }, … 6 au total ],
  "diplome": { "titre": "…", "texte": "…" },
  "invitation": { "titre": "…", "texte": "…" },
  "guide": { "materiel": ["…"], "preparation": ["…"], "cachettes": [ { "carte": 2, "cachette": "…", "variante": "…" }, … ], "deroule": ["…"], "adaptations": ["…"], "securite": ["…"] },
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "planche-personnage", "prompt": "…" }, { "page": "lettre", "prompt": "…" }, { "page": "carte", "prompt": "…" }, { "page": "diplome", "prompt": "…" }, { "page": "invitation", "prompt": "…" }, { "page": "enigme-image-1", "prompt": "…" }, … jusqu'à enigme-image-10 ],
  "boutique": {
    "name": "Mission astronaute",
    "slug": "mission-astronaute",
    "tagline": "10 énigmes, un plan secret de la station et une capsule à retrouver à la maison",
    "shortDescription": "… (≤ 400 caractères)",
    "longDescription": "… (markdown, 150 à 250 mots, structure : Tout est dans le kit / 10 énigmes 2 versions / Un plan en 10 morceaux / Zéro prise de tête / Comment ça marche)",
    "story": "… (le message radio, en markdown)",
    "template": "ADVENTURE", "categorySlug": "chasses-au-tresor", "universe": "Espace",
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
