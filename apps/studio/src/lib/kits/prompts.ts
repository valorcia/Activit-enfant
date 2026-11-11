/**
 * Prompts de génération des kits, dérivés de docs/prompts/*.md et paramétrés par la
 * personnalisation du livre (univers, personnage, compagnon, lieu, ton, nombre d'éléments).
 */
import { ageRangeLabel } from "../schemas/activity";
import type { KitContentFormat, KitCustomization } from "./schemas";
import { KIT_TYPES, isAdultAge, typesForPreset, type KitTypeDef } from "./types";
import { PRESETS, type PresetDef } from "../universes/presets";
import type { Site } from "../universes/sites";
import { coloringComplexity } from "./coloring";
import { ITEMS_KEY } from "./schemas";

export const SYSTEM_KIT_EDITOR = PRESETS["kit-enfants"].system;

/** Prompt système : persona de l'auteur selon le préréglage de l'univers (plan : éditeur multi-univers). */
export function systemPromptFor(p: PresetDef | null): string {
  if (!p) {
    return "Tu es directeur éditorial d'une plateforme d'e-books à imprimer (PDF A4) organisée en univers : kits et jeux pour enfants, guides pratiques experts pour adultes, livres de recettes, fiches de sciences pour enfants. Tu écris en français. Tu n'inventes ni avis, ni chiffres de vente, ni promesses irréalistes, et tu ne cites aucune marque ni personnage sous licence. Tu réponds uniquement avec un JSON strictement conforme au schéma demandé.";
  }
  return p.system;
}

export interface ContentPromptArgs {
  def: KitTypeDef;
  title: string;
  ageRange: string;
  count: number;
  c: KitCustomization;
  brief?: string | null;
  tone?: string;
}

/** Prompt de rédaction du contenu complet selon le format du kit. */
export function contentPromptFor(format: KitContentFormat, a: ContentPromptArgs): string {
  switch (format) {
    case "treasure_hunt": return treasureHuntPrompt(a);
    case "pranks": return pranksPrompt(a);
    case "guide": return guidePrompt(a);
    case "recipes": return recipesPrompt(a);
    case "science": return sciencePrompt(a);
    case "coloring": return coloringPrompt(a);
  }
}

const audienceLabel = (ageRange: string) => (isAdultAge(ageRange) ? "des adultes" : `enfants de ${ageRangeLabel(ageRange)}`);

const BOUTIQUE_JSON = `"boutique": { "name": "…", "tagline": "…", "shortDescription": "… (≤ 400 caractères)", "longDescription": "markdown 150 à 250 mots", "tags": ["…"], "heroBadges": ["…"], "faq": [ { "question": "…", "answer": "…" } ], "sellingPoints": [ { "title": "…", "description": "…", "icon": "check" } ], "seoTitle": "≤ 70 caractères", "seoDescription": "≤ 160 caractères", "keywords": ["…"] }`;

export function guidePrompt(o: ContentPromptArgs) {
  return `MISSION : écrire le contenu complet du guide pratique « ${o.title} » pour ${audienceLabel(o.ageRange)}, à imprimer (PDF A4).
Ton : ${o.tone || o.c.tone || "clair, rassurant et précis"}.
${o.c.universe ? `Domaine : ${o.c.universe}.` : ""}
Structure attendue :
1. Introduction (120 à 200 mots) : à qui s'adresse le guide, ce que le lecteur saura faire à la fin.
2. Le problème : description concrète des symptômes (ce que le lecteur observe).
3. Les causes principales (3 à 8), chacune expliquée simplement.
4. Un diagnostic pas à pas sous forme de questions (si oui → …, si non → …).
5. ${o.count} chapitres de méthode, chacun avec : numero, titre, resume (une phrase), contenu (150 à 350 mots, paragraphes courts), etapes (3 à 8 actions concrètes), conseil (astuce de pro), attention (mise en garde ou chaîne vide), tableau facultatif (ex. dosages indicatifs, fréquences : colonnes + lignes ; sinon null), illustration_description (schéma pédagogique à dessiner, sans texte).
6. Erreurs fréquentes (5 à 10) avec la bonne pratique.
7. Une checklist imprimable (8 à 15 cases), un calendrier d'entretien (par période), une FAQ (5 à 8 questions) et un glossaire (6 à 15 termes).
8. Consignes de sécurité générales.
RÈGLES : aucune promesse irréaliste (pas de « garanti », pas de résultat chiffré invérifiable) ; aucune statistique ni norme inventée ; aucune marque commerciale ; quand des produits chimiques ou des outils dangereux sont évoqués : porter des gants et des lunettes, ne jamais mélanger les produits, respecter les doses et l'étiquette du fabricant, stocker hors de portée des enfants, demander l'avis d'un professionnel en cas de doute ; les valeurs indicatives sont présentées comme telles.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

FORMAT : uniquement un objet JSON :
{
  "titre": "${o.title}", "sous_titre": "…",
  "auteur": { "nom": "", "expertise": "" },
  "introduction": "…",
  "probleme": { "titre": "…", "texte": "…" },
  "causes": [ { "titre": "…", "explication": "…" } ],
  "diagnostic": [ { "question": "…", "si_oui": "…", "si_non": "…" } ],
  "chapitres": [ { "numero": 1, "titre": "…", "resume": "…", "contenu": "…", "etapes": ["…"], "conseil": "…", "attention": "…", "tableau": { "titre": "…", "colonnes": ["…"], "lignes": [["…"]] }, "illustration_description": "…" } ],
  "erreurs": [ { "erreur": "…", "solution": "…" } ],
  "checklist": { "titre": "…", "items": ["…"] },
  "calendrier": [ { "periode": "…", "actions": ["…"] } ],
  "faq": [ { "question": "…", "reponse": "…" } ],
  "glossaire": [ { "terme": "…", "definition": "…" } ],
  "securite": ["…"],
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "chapitre-1", "prompt": "…" } ],
  ${BOUTIQUE_JSON}
}
"chapitres" contient exactement ${o.count} éléments et "illustrations" une entrée "chapitre-N" par chapitre. Les prompts d'illustration décrivent un schéma ou une scène pédagogique, sans texte ni chiffre.`;
}

export function recipesPrompt(o: ContentPromptArgs) {
  return `MISSION : écrire le contenu complet du livre de recettes « ${o.title} » pour ${audienceLabel(o.ageRange)}, à imprimer (PDF A4) : ${o.count} recettes.
Ton : ${o.tone || o.c.tone || "gourmand, simple et encourageant"}.
${o.c.universe ? `Thème : ${o.c.universe}.` : ""}
Chaque recette : numero, titre, resume (une phrase gourmande), portions, temps_preparation_minutes, temps_cuisson_minutes, difficulte (1 à 3), ingredients (quantités précises), etapes (courtes et numérotables), astuce, allergenes (parmi les 14 allergènes réglementaires présents), illustration_description (le plat à dessiner, sans texte).
Ajoute une introduction (100 à 180 mots) et des conseils généraux (organisation, conservation, hygiène).
RÈGLES : temps et quantités réalistes ; cuisson à cœur des viandes et des œufs pour les publics fragiles ; aucune allégation santé non prouvée ; aucune marque commerciale.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

FORMAT : uniquement un objet JSON :
{
  "titre": "${o.title}", "sous_titre": "…",
  "introduction": "…",
  "recettes": [ { "numero": 1, "titre": "…", "resume": "…", "portions": 4, "temps_preparation_minutes": 15, "temps_cuisson_minutes": 20, "difficulte": 1, "ingredients": ["…"], "etapes": ["…"], "astuce": "…", "allergenes": ["…"], "illustration_description": "…" } ],
  "conseils": ["…"],
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "recette-1", "prompt": "…" } ],
  ${BOUTIQUE_JSON}
}
"recettes" contient exactement ${o.count} éléments et "illustrations" une entrée "recette-N" par recette.`;
}

export function sciencePrompt(o: ContentPromptArgs) {
  return `MISSION : écrire le contenu complet des fiches d'expériences « ${o.title} » pour enfants de ${ageRangeLabel(o.ageRange)}, à imprimer (PDF A4) : ${o.count} expériences réalisables à la maison avec du matériel courant.
Ton : ${o.tone || o.c.tone || "curieux, enthousiaste et clair"}.
${o.c.universe ? `Thème : ${o.c.universe}.` : ""}
${o.c.heroName ? `Personnage guide : ${o.c.heroName}${o.c.heroDescription ? ` (${o.c.heroDescription})` : ""}.` : "Invente un personnage guide scientifique attachant (nom, apparence courte)."}
Chaque expérience : numero, titre, question (ce que l'on cherche à découvrir), materiel, etapes (3 à 8), explication (juste et simple), pour_aller_plus_loin, securite (consignes adaptées), duree_minutes, difficulte (1 à 3), age_conseille, illustration_description (scène à dessiner, sans texte).
Ajoute une introduction (80 à 150 mots), des règles de sécurité générales et un diplôme de petit scientifique.
RÈGLES : présence d'un adulte pour toute chaleur, tout outil coupant ou tout produit ménager ; aucun produit dangereux ; aucune marque ni personnage sous licence.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

FORMAT : uniquement un objet JSON :
{
  "titre": "${o.title}", "sous_titre": "…",
  "personnage": { "nom": "…", "description": "…" },
  "introduction": "…",
  "experiences": [ { "numero": 1, "titre": "…", "question": "…", "materiel": ["…"], "etapes": ["…"], "explication": "…", "pour_aller_plus_loin": "…", "securite": ["…"], "duree_minutes": 20, "difficulte": 1, "age_conseille": "6+", "illustration_description": "…" } ],
  "diplome": { "titre": "…", "texte": "…" },
  "securite_generale": ["…"],
  "illustrations": [ { "page": "couverture", "prompt": "…" }, { "page": "experience-1", "prompt": "…" } ],
  ${BOUTIQUE_JSON}
}
"experiences" contient exactement ${o.count} éléments et "illustrations" une entrée "experience-N" par expérience.`;
}

export const HIDING_PLACES = [
  "frigo", "canapé", "lave-linge", "chaussures de l'entrée", "pot de plante", "baignoire", "étagère à livres", "boîte aux lettres", "oreiller", "coffre à jouets", "tiroir à couverts", "panier à linge",
  "sous le tapis", "derrière un rideau", "dans une botte", "sous la table", "dans le placard à balais", "derrière la porte d'entrée", "dans un sac à dos", "sous un coussin du fauteuil", "dans la boîte à chaussures", "près de la poubelle de tri", "dans le porte-parapluie", "sous l'escabeau",
];

/** Cachettes imposées (liste au-delà de laquelle l'auteur invente des cachettes variées, sans répétition). */
export function hidingPlacesFor(count: number): string {
  const listed = HIDING_PLACES.slice(0, Math.min(count, HIDING_PLACES.length)).join(", ");
  return count > HIDING_PLACES.length ? `${listed}, puis ${count - HIDING_PLACES.length} autres cachettes de la maison ou du jardin que tu choisis (toutes différentes, aucune répétition)` : listed;
}

function persona(c: KitCustomization, def: KitTypeDef) {
  return [
    c.universe ? `Univers : ${c.universe}.` : def.defaultUniverse ? `Univers : ${def.defaultUniverse}.` : "",
    c.heroName ? `Personnage guide : ${c.heroName}${c.heroDescription ? ` (${c.heroDescription})` : ""}.` : "Invente un personnage guide attachant (nom, apparence courte).",
    c.companion ? `Compagnon : ${c.companion}.` : "Ajoute un compagnon animal ou robot qui donne les indices de secours.",
    c.place ? `Lieu ou véhicule : ${c.place}.` : "",
    c.tone ? `Ton : ${c.tone}.` : "",
  ].filter(Boolean).join("\n");
}

export function treasureHuntPrompt(o: ContentPromptArgs) {
  const places = hidingPlacesFor(o.count);
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

export function pranksPrompt(o: ContentPromptArgs) {
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

/** Prompt « brief libre → plan de kit » (JSON KitPlan), avec choix de l'univers parmi ceux de la boutique. */
export function briefToPlanPrompt(brief: string, sites: Array<Pick<Site, "slug" | "name" | "preset" | "audience" | "categories">> = []) {
  const universes = sites.length
    ? sites
        .map((s) => {
          const types = typesForPreset(s.preset).filter((k) => k.family === "kit").map((k) => k.key).join(", ");
          return `- ${s.slug} : « ${s.name} » (${PRESETS[s.preset].label} — audience : ${s.audience.name}) · types possibles : ${types} · catégories : ${s.categories.map((c) => c.slug).join(", ") || "—"}`;
        })
        .join("\n")
    : "";
  const types = KIT_TYPES.filter((k) => k.family === "kit" || !universes).map((k) => `- ${k.key} : ${k.label} — ${k.description}`).join("\n");
  return `Voici une demande libre d'un éditeur d'e-books à imprimer. Transforme-la en plan de production.

DEMANDE :
"""
${brief.trim().slice(0, 12000)}
"""
${universes ? `\nUnivers de la boutique (choisis celui qui correspond le mieux au sujet et au public ; le type d'e-book doit être compatible avec l'univers) :\n${universes}\n` : ""}
Types d'e-books disponibles (choisis le plus adapté) :
${types}

Réponds uniquement avec un objet JSON :
{
  ${universes ? '"siteSlug": "slug de l\'univers choisi ci-dessus",\n  ' : ""}"kitType": "clé du type ci-dessus",
  "title": "titre commercial",
  "subtitle": "sous-titre (bénéfice principal)",
  "ageRange": "3-5 | 5-8 | 8-10 | 3-10 (enfants) ou 18-99 (adultes)",
  "universe": "univers ou domaine (pirates, dinosaures, piscine, cuisine du quotidien…)",
  "heroName": "nom du personnage guide (chaîne vide pour un guide ou un livre de recettes)",
  "heroDescription": "apparence en une phrase",
  "companion": "compagnon (animal, robot…) ou chaîne vide",
  "place": "lieu ou véhicule, ou chaîne vide",
  "tone": "ton",
  "count": 10,
  "priceCents": 990,
  "shopCategorySlug": "slug d'une catégorie de l'univers choisi",
  "notes": "toutes les consignes utiles de la demande à transmettre à l'auteur"
}
N'invente rien qui contredise la demande ; laisse une chaîne vide si une information manque.`;
}

/** Prompt d'image : scène, personnage récurrent, puis charte d'illustration du studio. */
export function kitImagePrompt(charter: string, prompt: string, characterNote?: string) {
  return [prompt.trim(), characterNote ? `Personnage récurrent : ${characterNote}.` : "", charter.trim()].filter(Boolean).join("\n\n");
}

export function coloringPrompt(o: ContentPromptArgs) {
  const cx = coloringComplexity(o.ageRange);
  return `MISSION : écrire le contenu complet du cahier de coloriage « ${o.title} » pour enfants de ${ageRangeLabel(o.ageRange)}, à imprimer (PDF A4 portrait, une page par dessin) : ${o.count} dessins à colorier.
Thème : ${o.c.universe || "libre (choisis un thème cohérent avec le titre)"}.
Ton : ${o.tone || o.c.tone || "joyeux et tendre"}.
Complexité : ${cx.label}. ${cx.rule}
Chaque dessin : numero, titre (court, ce que l'enfant voit : « Tricératops qui mange des feuilles »), description (la scène à dessiner : sujet, pose, expression, 1 à 3 éléments de décor ; c'est le prompt du dessinateur, au présent, sans couleur puisque le dessin est au trait), legende (phrase courte et douce imprimée sous le dessin, ou chaîne vide), niveau_detail ("simple" | "moyen" | "detaille").
Variété : alterne gros plans et scènes, poses et décors ; aucun dessin en double ; progression du plus simple au plus détaillé si l'âge le permet.
Ajoute : une introduction (40 à 80 mots : comment utiliser le cahier, conseil papier 120 g pour les feutres), la page « Ce cahier appartient à… » (titre + texte court), un diplôme « Artiste en herbe » (titre + texte), 3 à 6 conseils aux parents.
RÈGLES : aucun personnage sous licence, aucune marque, rien d'effrayant ; les dessins ne contiennent jamais de texte.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

FORMAT : uniquement un objet JSON :
{
  "titre": "${o.title}", "sous_titre": "…", "theme": "…",
  "introduction": "…",
  "dessins": [ { "numero": 1, "titre": "…", "description": "…", "legende": "…", "niveau_detail": "${cx.level}" } ],
  "page_appartient": { "titre": "Ce cahier appartient à", "texte": "…" },
  "diplome": { "titre": "Diplôme d'artiste en herbe", "texte": "…" },
  "conseils": ["…"],
  "illustrations": [ { "page": "couverture", "prompt": "… (couverture EN COULEUR, joyeuse, personnages du thème)" } ],
  ${BOUTIQUE_JSON}
}
"dessins" contient exactement ${o.count} éléments.`;
}

// ---------------------------------------------------------------------------
// Rédaction par lots (livres de plus de 20 éléments)
// ---------------------------------------------------------------------------

/** Forme JSON d'un élément principal, par format (rappel dans les prompts de lots). */
export const ITEM_JSON_EXAMPLE: Record<KitContentFormat, string> = {
  treasure_hunt: `{ "numero": 1, "cachette": "…", "texte": "…", "indice_secours": "…", "image_description": "…" }`,
  pranks: `{ "numero": 1, "titre": "…", "resume": "…", "materiel": ["…"], "preparation": ["…"], "temps_minutes": 5, "difficulte": 1, "age_conseille": "3+", "message_du_lutin": "…", "variante_sans_materiel": null, "illustration_description": "…" }`,
  guide: `{ "numero": 1, "titre": "…", "resume": "…", "contenu": "…", "etapes": ["…"], "conseil": "…", "attention": "…", "tableau": null, "illustration_description": "…" }`,
  recipes: `{ "numero": 1, "titre": "…", "resume": "…", "portions": 4, "temps_preparation_minutes": 15, "temps_cuisson_minutes": 20, "difficulte": 1, "ingredients": ["…"], "etapes": ["…"], "astuce": "…", "allergenes": ["…"], "illustration_description": "…" }`,
  science: `{ "numero": 1, "titre": "…", "question": "…", "materiel": ["…"], "etapes": ["…"], "explication": "…", "pour_aller_plus_loin": "…", "securite": ["…"], "duree_minutes": 20, "difficulte": 1, "age_conseille": "6+", "illustration_description": "…" }`,
  coloring: `{ "numero": 1, "titre": "…", "description": "…", "legende": "…", "niveau_detail": "moyen" }`,
};

const ITEM_NOUN: Record<KitContentFormat, string> = { treasure_hunt: "énigmes", pranks: "idées", guide: "chapitres", recipes: "recettes", science: "expériences", coloring: "dessins" };

/** Sommaire complet (titres seulement) : garantit l'absence de doublons entre les lots. */
export function outlinePrompt(format: KitContentFormat, o: ContentPromptArgs) {
  const noun = ITEM_NOUN[format];
  return `MISSION : établir le SOMMAIRE de « ${o.title} » (${o.def.label.toLowerCase()}, ${audienceLabel(o.ageRange)}) : exactement ${o.count} ${noun}, tous différents.
${o.c.universe ? `Thème / univers : ${o.c.universe}.` : ""}
${format === "treasure_hunt" ? `Cachettes, dans cet ordre : ${hidingPlacesFor(o.count)}.` : ""}
${format === "coloring" ? coloringComplexity(o.ageRange).rule : ""}
Pour chacun : numero, titre (court et explicite), idee (une phrase : l'angle ou la scène, pour qu'aucun élément ne ressemble à un autre). Varie les sujets, les situations et la difficulté.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}
${o.brief ? `Demande initiale : ${o.brief}` : ""}

FORMAT : uniquement un objet JSON :
{ "elements": [ { "numero": 1, "titre": "…", "idee": "…" } ] }
"elements" contient exactement ${o.count} entrées, numérotées de 1 à ${o.count}.`;
}

/** Note ajoutée au prompt complet quand il ne rédige que le premier lot (cadre du livre + éléments 1 à n). */
export function firstBatchNote(format: KitContentFormat, total: number, slice: Array<{ numero: number; titre: string; idee?: string }>) {
  const noun = ITEM_NOUN[format];
  return `

IMPORTANT — LIVRE RÉDIGÉ PAR LOTS : le livre complet compte ${total} ${noun}. Dans cette réponse, rédige toutes les autres parties (introduction, lettres, guide, fiche boutique…) pour l'ensemble des ${total} ${noun}, mais seulement les ${slice.length} premiers ${noun} du sommaire, dans "${ITEMS_KEY[format]}" :
${slice.map((x) => `${x.numero}. ${x.titre}${x.idee ? ` — ${x.idee}` : ""}`).join("\n")}
Les autres ${noun} seront rédigés ensuite, à part.`;
}

/** Lot d'éléments (sans le reste du livre) à partir des titres du sommaire. */
export function itemsBatchPrompt(format: KitContentFormat, o: ContentPromptArgs, slice: Array<{ numero: number; titre: string; idee?: string }>, context: { hero?: string; companion?: string; total: number }) {
  const noun = ITEM_NOUN[format];
  const first = slice[0]?.numero ?? 1;
  const last = slice[slice.length - 1]?.numero ?? first;
  return `MISSION : rédiger les ${noun} ${first} à ${last} (sur ${context.total}) de « ${o.title} » (${o.def.label.toLowerCase()}, ${audienceLabel(o.ageRange)}).
${o.c.universe ? `Thème / univers : ${o.c.universe}.` : ""}
${context.hero ? `Personnage : ${context.hero}${context.companion ? `, compagnon : ${context.companion}` : ""}.` : ""}
Ton : ${o.tone || o.c.tone || "joyeux"}.
${format === "coloring" ? coloringComplexity(o.ageRange).rule : ""}
Rédige exactement ces ${slice.length} ${noun}, avec ces numéros et ces titres (tu peux affiner un titre sans changer son sujet) :
${slice.map((x) => `${x.numero}. ${x.titre}${x.idee ? ` — ${x.idee}` : ""}`).join("\n")}
Même niveau d'exigence que le reste du livre ; aucune répétition avec les autres ${noun}.
${o.c.extraInstructions ? `Consignes supplémentaires : ${o.c.extraInstructions}` : ""}

FORMAT : uniquement un objet JSON :
{ "items": [ ${ITEM_JSON_EXAMPLE[format]} ] }
"items" contient exactement ${slice.length} éléments.`;
}
