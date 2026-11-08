/**
 * Prompts de génération des kits, dérivés de docs/prompts/*.md et paramétrés par la
 * personnalisation du livre (univers, personnage, compagnon, lieu, ton, nombre d'éléments).
 */
import { ageRangeLabel } from "../schemas/activity";
import type { KitCustomization } from "./schemas";
import { KIT_TYPES, type KitTypeDef } from "./types";

export const SYSTEM_KIT_EDITOR =
  "Tu es auteur de jeux pour enfants et directeur éditorial de La Malle à Jeux, une marque de kits d'activités à imprimer (PDF A4). Tu écris en français, pour des parents qui organisent l'activité à la maison ou au jardin, sans achat spécial. Ton chaleureux, vocabulaire simple, humour gentil, jamais effrayant. Aucune marque ni personnage sous licence. Aucune invention commerciale (pas de chiffres de ventes, pas d'avis). Tu réponds uniquement avec un JSON strictement conforme au schéma demandé.";

const HIDING_PLACES = ["frigo", "canapé", "lave-linge", "chaussures de l'entrée", "pot de plante", "baignoire", "étagère à livres", "boîte aux lettres", "oreiller", "coffre à jouets", "tiroir à couverts", "panier à linge"];

function persona(c: KitCustomization, def: KitTypeDef) {
  return [
    c.universe ? `Univers : ${c.universe}.` : def.defaultUniverse ? `Univers : ${def.defaultUniverse}.` : "",
    c.heroName ? `Personnage guide : ${c.heroName}${c.heroDescription ? ` (${c.heroDescription})` : ""}.` : "Invente un personnage guide attachant (nom, apparence courte).",
    c.companion ? `Compagnon : ${c.companion}.` : "Ajoute un compagnon animal ou robot qui donne les indices de secours.",
    c.place ? `Lieu ou véhicule : ${c.place}.` : "",
    c.tone ? `Ton : ${c.tone}.` : "",
  ].filter(Boolean).join("\n");
}

export function treasureHuntPrompt(o: { def: KitTypeDef; title: string; ageRange: string; count: number; c: KitCustomization; brief?: string | null }) {
  const places = HIDING_PLACES.slice(0, o.count).join(", ");
  return `MISSION : écrire le contenu complet d'un kit « ${o.title} » (${o.def.label.toLowerCase()}) pour enfants de ${ageRangeLabel(o.ageRange)}, sur la mécanique de « Le trésor de la Capitaine Coquelicot » :
- PDF A4 à imprimer.
${persona(o.c, o.def)}
- ${o.count} énigmes menant chacune à une cachette de la maison, dans cet ordre : ${places}. Chaque énigme existe en DEUX versions : texte (7–8 ans, qui lisent) et image (5–6 ans : décrire la scène à illustrer où la cachette est évidente). Chaque carte texte porte un indice de secours donné par le compagnon (« … dit : cherche … »).
- Une carte au trésor en ${Math.min(10, o.count)} morceaux : chaque énigme résolue donne un morceau ; le X révèle où dort le trésor ; cadre vide sous le X où le parent écrit la cachette.
- Lettre du personnage qui lance l'aventure (120 à 160 mots, règle du jeu, présentation du compagnon).
- 6 défis courts, physiques et drôles, sans matériel, à glisser entre les énigmes.
- Diplôme à personnaliser (nom, date, signature) et invitation d'anniversaire (date, heure, lieu, répondre avant le).
- Guide de l'organisateur : matériel, préparation en 20 minutes, plan des cachettes avec une variante pour chacune, déroulé 45–60 minutes, adaptations par âge et grand groupe, conseils de sécurité.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

RÈGLES : énigmes résolubles en 1 à 3 minutes ; cachettes présentes dans la majorité des logements ; pas de violence.

FORMAT : uniquement un objet JSON :
{
  "titre": "${o.title}", "sous_titre": "…",
  "personnage": { "nom": "…", "description": "…", "compagnon": "…", "vehicule": "…" },
  "lettre": "…",
  "enigmes": [ { "numero": 1, "cachette": "frigo", "texte": "…", "indice_secours": "…", "image_description": "…" } ],
  "carte": { "titre": "…", "consigne_parent": "…", "image_description": "…" },
  "defis": [ { "titre": "…", "consigne": "…" } ],
  "diplome": { "titre": "…", "texte": "…" },
  "invitation": { "titre": "…", "texte": "…" },
  "guide": { "materiel": ["…"], "preparation": ["…"], "cachettes": [ { "carte": 2, "cachette": "…", "variante": "…" } ], "deroule": ["…"], "adaptations": ["…"], "securite": ["…"] },
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "planche-personnage", "prompt": "…" }, { "page": "lettre", "prompt": "…" }, { "page": "carte", "prompt": "…" }, { "page": "diplome", "prompt": "…" }, { "page": "invitation", "prompt": "…" }, { "page": "enigme-image-1", "prompt": "…" } ],
  "boutique": { "name": "…", "tagline": "…", "shortDescription": "… (≤ 400 caractères)", "longDescription": "markdown 150 à 250 mots", "tags": ["…"], "heroBadges": ["…"], "materials": ["…"], "faq": [ { "question": "…", "answer": "…" } ], "sellingPoints": [ { "title": "…", "description": "…", "icon": "timer" } ], "seoTitle": "≤ 70 caractères", "seoDescription": "≤ 160 caractères", "keywords": ["…"] }
}
"enigmes" contient exactement ${o.count} éléments et "illustrations" une entrée "enigme-image-N" par énigme. Les prompts d'illustration décrivent la scène, le cadrage et l'absence de texte.`;
}

export function pranksPrompt(o: { def: KitTypeDef; title: string; ageRange: string; count: number; c: KitCustomization; brief?: string | null }) {
  return `MISSION : écrire le contenu complet de l'e-book « ${o.title} » (${o.def.label.toLowerCase()}) pour enfants de ${ageRangeLabel(o.ageRange)} : ${o.count} idées rapides (5 minutes maximum la veille au soir, matériel courant) à mettre en œuvre au fil des jours.
${persona(o.c, o.def)}
Contenu attendu :
1. Lettre d'arrivée du personnage (100 à 140 mots) : d'où il vient, ce qu'il fait la nuit, règle d'or, date de départ.
2. ${o.count} idées, chacune avec numero, titre, resume, materiel, preparation (3 à 5 étapes), temps_minutes, difficulte (1 à 3), age_conseille, message_du_lutin (mot à laisser), variante_sans_materiel (ou null), illustration_description. Répartition : un tiers très faciles, une moitié moyennes, le reste « grand jeu ». Au moins 5 idées impliquent une bonne action, sans moraliser. Rien de salissant irréversible, rien qui abîme le logement, rien d'effrayant.
3. 6 idées de réserve, 10 petits mots à découper, lettre de départ (90 à 120 mots), certificat à personnaliser, guide des parents (introduire selon l'âge, que faire en cas d'oubli, organisation, sécurité).
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

FORMAT : uniquement un objet JSON :
{
  "titre": "${o.title}", "sous_titre": "…",
  "personnages": [ { "nom": "…", "description": "…" } ],
  "lettre_arrivee": "…",
  "idees": [ { "numero": 1, "titre": "…", "resume": "…", "materiel": ["…"], "preparation": ["…"], "temps_minutes": 5, "difficulte": 1, "age_conseille": "3+", "message_du_lutin": "…", "variante_sans_materiel": null, "illustration_description": "…" } ],
  "idees_reserve": [ { "titre": "…", "resume": "…" } ],
  "mots_du_lutin": ["…"],
  "lettre_depart": "…",
  "certificat": { "titre": "…", "texte": "…" },
  "guide_parents": { "introduire": ["…"], "oubli": "…", "organisation": ["…"], "securite": ["…"] },
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "planche-personnages", "prompt": "…" }, { "page": "lettre-arrivee", "prompt": "…" }, { "page": "certificat", "prompt": "…" }, { "page": "idee-1", "prompt": "…" } ],
  "boutique": { "name": "…", "tagline": "…", "shortDescription": "…", "longDescription": "markdown 150 à 250 mots", "tags": ["…"], "heroBadges": ["…"], "materials": ["…"], "faq": [ { "question": "…", "answer": "…" } ], "sellingPoints": [ { "title": "…", "description": "…", "icon": "timer" } ], "seoTitle": "…", "seoDescription": "…", "keywords": ["…"] }
}
"idees" contient exactement ${o.count} éléments et "illustrations" une entrée "idee-N" par idée.`;
}

/** Prompt « brief libre → plan de kit » (JSON KitPlan). */
export function briefToPlanPrompt(brief: string) {
  const types = KIT_TYPES.map((k) => `- ${k.key} : ${k.label} — ${k.description}`).join("\n");
  return `Voici une demande libre d'un éditeur de La Malle à Jeux (kits d'activités à imprimer pour les 3–10 ans). Transforme-la en plan de production.

DEMANDE :
"""
${brief.trim().slice(0, 12000)}
"""

Types de kits disponibles (choisis le plus adapté) :
${types}

Réponds uniquement avec un objet JSON :
{
  "kitType": "clé du type ci-dessus",
  "title": "titre commercial du kit",
  "subtitle": "sous-titre (bénéfice principal)",
  "ageRange": "3-5 | 5-8 | 8-10 | 3-10",
  "universe": "univers (pirates, dinosaures, espace, Noël…)",
  "heroName": "nom du personnage guide",
  "heroDescription": "apparence en une phrase",
  "companion": "compagnon (animal, robot…)",
  "place": "lieu ou véhicule",
  "tone": "ton",
  "count": 10,
  "priceCents": 990,
  "shopCategorySlug": "chasses-au-tresor | activites-educatives | evenements | histoires-et-aventures",
  "notes": "toutes les consignes utiles de la demande à transmettre à l'auteur"
}
N'invente rien qui contredise la demande ; laisse une chaîne vide si une information manque.`;
}

/** Prompt d'image : scène, personnage récurrent, puis charte d'illustration du studio. */
export function kitImagePrompt(charter: string, prompt: string, characterNote?: string) {
  return [prompt.trim(), characterNote ? `Personnage récurrent : ${characterNote}.` : "", charter.trim()].filter(Boolean).join("\n\n");
}
