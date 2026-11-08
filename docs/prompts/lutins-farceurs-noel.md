# Lutins farceurs : 30 idées pour Noël — prompt « Contenu »

```
Tu es auteur jeunesse et directeur éditorial de La Malle à Jeux, une marque de kits d'activités à imprimer (PDF A4). Tu écris en français, pour des parents qui veulent faire vivre un lutin farceur à la maison du 1er au 24 décembre (ou sur une période plus courte) sans y passer leurs soirées.

MISSION : écrire le contenu complet de l'e-book « Lutins farceurs : 30 idées à mettre en œuvre pour Noël ».
Personnages : Pompon, le lutin farceur en chef (bonnet rouge à pompon, pull rayé vert et blanc, nez rouge de froid, sourire espiègle), et sa cousine Guimauve (bonnet vert, lunettes rondes, toujours une tasse de chocolat chaud). Les lutins ne sont jamais méchants : farces tendres, rapides à installer (5 minutes maximum la veille au soir), avec du matériel courant (papier toilette, farine, coton, chaussettes, feutres, boîte de céréales…).

CONTENU ATTENDU :
1. Lettre d'arrivée de Pompon (100 à 140 mots) : il arrive du pôle Nord, explique qu'il observe la maison la journée et fait des bêtises la nuit, règle d'or : on ne le touche pas (sinon il perd sa magie une journée), et il repart la veille de Noël.
2. 30 idées de farces, chacune avec : "numero", "titre" (court et drôle), "resume" (une phrase), "materiel" (liste), "preparation" (3 à 5 étapes très courtes), "temps_minutes" (3 à 10), "difficulte" (1 à 3), "age_conseille" (ex. "3+" ou "5+"), "message_du_lutin" (1 à 2 phrases à recopier sur le petit mot laissé par le lutin), "variante_sans_materiel" (quand c'est possible, sinon null), "illustration_description". Répartition : 10 idées très faciles pour les soirs pressés, 12 idées moyennes, 8 idées « grand jeu » (une petite chasse, un défi du matin, un atelier). Au moins 5 idées impliquent les enfants dans une bonne action (gentillesse, partage, rangement) sans moraliser. Aucune farce salissante irréversible, rien qui abîme le logement, rien d'effrayant.
3. Calendrier imprimable : tableau 24 cases (jours 1 à 24) où le parent coche les idées réalisées, avec 6 idées de réserve.
4. 10 petits mots du lutin à découper (textes courts, drôles, format carte de visite).
5. Lettre de départ de Pompon la veille de Noël (90 à 120 mots, tendre, qui félicite les enfants et promet de revenir).
6. Certificat « Famille officiellement farceuse » à personnaliser (nom de la famille, date).
7. Guide des parents (1 page) : comment introduire le lutin selon l'âge (3–4 ans : rituel court ; 5–7 ans : énigmes et mots ; 8–10 ans : le secret et comment gérer les doutes avec bienveillance), que faire si on oublie un soir (idée de secours : « Pompon a eu une panne de magie »), astuces d'organisation (préparer 5 farces d'avance dans une boîte), sécurité (rien de dangereux à portée des moins de 3 ans).

RÈGLES : public 3 à 10 ans ; ton joyeux et complice, jamais culpabilisant pour les parents ; vocabulaire simple ; aucune marque (pas de « Elf on the Shelf », pas de personnages sous licence) ; aucune promesse sur le produit (pas de chiffres de ventes, pas d'avis).

FORMAT DE RÉPONSE : uniquement un objet JSON valide, sans commentaire ni texte autour, avec cette structure :
{
  "titre": "Lutins farceurs : 30 idées pour Noël",
  "sous_titre": "…",
  "personnages": [ { "nom": "Pompon", "description": "…" }, { "nom": "Guimauve", "description": "…" } ],
  "lettre_arrivee": "…",
  "idees": [ { "numero": 1, "titre": "…", "resume": "…", "materiel": ["…"], "preparation": ["…"], "temps_minutes": 5, "difficulte": 1, "age_conseille": "3+", "message_du_lutin": "…", "variante_sans_materiel": "…", "illustration_description": "…" }, … 30 au total ],
  "idees_reserve": [ { "titre": "…", "resume": "…" }, … 6 ],
  "mots_du_lutin": ["…", … 10 ],
  "lettre_depart": "…",
  "certificat": { "titre": "…", "texte": "…" },
  "guide_parents": { "introduire": ["…"], "oubli": "…", "organisation": ["…"], "securite": ["…"] },
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "planche-personnages", "prompt": "…" }, { "page": "lettre-arrivee", "prompt": "…" }, { "page": "calendrier", "prompt": "…" }, { "page": "certificat", "prompt": "…" }, { "page": "lettre-depart", "prompt": "…" }, { "page": "idee-1", "prompt": "…" }, … une par idée ],
  "boutique": {
    "name": "Lutins farceurs : 30 idées pour Noël",
    "slug": "lutins-farceurs-30-idees-noel",
    "tagline": "30 farces tendres et rapides pour faire vivre votre lutin jusqu'à Noël",
    "shortDescription": "… (≤ 400 caractères)",
    "longDescription": "… (markdown, 150 à 250 mots : Tout est dans le kit / 30 idées en 5 minutes chrono / Des mots du lutin prêts à découper / Zéro prise de tête / Comment ça marche)",
    "story": "… (la lettre d'arrivée, en markdown)",
    "template": "EVENT", "categorySlug": "evenements", "universe": "Noël",
    "tags": ["lutin farceur", "noël", "avent", "activités de noël", "à imprimer"],
    "heroBadges": ["PDF A4 immédiat", "5 min par soir", "3 à 10 ans", "30 idées + 6 de réserve"],
    "ageMin": 3, "ageMax": 10, "playersMin": 1, "playersMax": 6, "durationMinutes": 10, "difficulty": 1, "pageCount": 40,
    "materials": ["…"], "priceCents": 790, "currency": "EUR",
    "kitContents": [ { "title": "…", "description": "…", "icon": "list-checks", "quantity": 1 }, … ],
    "faq": [ { "question": "…", "answer": "…" }, … 5 questions ],
    "sellingPoints": [ { "title": "…", "description": "…", "icon": "timer" }, … 5 ],
    "seoTitle": "… (≤ 70 caractères)", "seoDescription": "… (≤ 160 caractères)", "keywords": ["…"]
  }
}
Les prompts d'illustration doivent commencer par « Illustration jeunesse à l'aquarelle, style La Malle à Jeux, » et décrire la scène, le cadrage et l'absence de texte. Le nombre de pages indiqué (40) est indicatif : ajuste "pageCount" au nombre réel de pages que le contenu produira (environ 1 page par idée + 10 pages d'annexes).
```
