import { ART_STYLES, ageRangeLabel, type ActivityContent, type VisualReferenceSheet } from "../schemas/activity";

export const SYSTEM_EDITOR = `Tu es un auteur et éditeur jeunesse expérimenté, spécialisé dans les livres d'activités scientifiques, créatives et manuelles pour enfants. Tu écris en français, avec un ton chaleureux, précis et encourageant, adapté à l'âge indiqué. Tu privilégies la sécurité, la faisabilité réelle avec du matériel courant, et l'exactitude scientifique. Tu réponds toujours avec un JSON strictement conforme au schéma demandé.`;

export function outlinePrompt(o: { bookType: string; category: string; ageRange: string; count: number; brief?: string; artStyle: string; existingTitles?: string[] }) {
  return `Conçois le sommaire d'un livre d'activités pour enfants.

Type de livre : ${o.bookType}
Catégorie des activités : ${o.category}
Public : ${ageRangeLabel(o.ageRange)}
Nombre d'activités : ${o.count}
${o.brief ? `Demande de l'éditeur : ${o.brief}` : ""}
${o.existingTitles?.length ? `Évite ces activités déjà existantes : ${o.existingTitles.join(" ; ")}` : ""}

Exigences :
- Activités variées (notions différentes, matériaux différents, difficultés progressives).
- Chaque activité doit produire un objet ou un résultat concret et illustrable.
- Matériel courant, peu coûteux, sans danger pour l'âge indiqué.
- Pas deux activités reposant sur la même notion principale.
- Titres accrocheurs, à la deuxième personne quand c'est naturel.

Réponds avec un JSON :
{
  "title": "titre du livre",
  "subtitle": "sous-titre",
  "introduction": "texte d'introduction (3 à 5 phrases) adressé à l'enfant",
  "activities": [
    { "title": "...", "summary": "1 à 2 phrases", "category": "${o.category}", "finalObject": "objet final décrit précisément", "mainConcept": "notion principale", "difficulty": 1-5, "durationMinutes": 10-120, "keyMaterials": ["...", "..."] }
  ]
}`;
}

export function activityPrompt(o: { concept: { title: string; summary: string; category: string; finalObject: string; mainConcept: string; difficulty: number; durationMinutes: number; keyMaterials: string[] }; ageRange: string; bookTitle?: string }) {
  return `Rédige la fiche complète de l'activité suivante pour un livre d'activités destiné aux enfants de ${ageRangeLabel(o.ageRange)}${o.bookTitle ? ` (livre « ${o.bookTitle} »)` : ""}.

Titre : ${o.concept.title}
Résumé : ${o.concept.summary}
Objet final : ${o.concept.finalObject}
Notion principale : ${o.concept.mainConcept}
Difficulté visée : ${o.concept.difficulty}/5 — Durée visée : ${o.concept.durationMinutes} min
Matériel clé : ${o.concept.keyMaterials.join(", ")}

Exigences de qualité :
- Entre 4 et 8 étapes, chacune réalisable, dans l'ordre, avec une instruction concrète (verbes d'action, quantités, dimensions).
- Tout matériel listé doit être utilisé dans les étapes, et rien d'utilisé ne doit manquer dans la liste.
- Pour chaque étape, un "illustrationBrief" décrivant précisément ce que l'image doit montrer (objet, état d'avancement, couleurs, point de vue), sans texte dans l'image.
- "finalIllustrationBrief" : description précise de l'objet terminé.
- Explication scientifique/pédagogique exacte, vulgarisée pour l'âge, 80 à 200 mots.
- Consignes de sécurité honnêtes (outils, petites pièces, substances, chaleur) et niveau de supervision adulte.
- Durée cohérente avec le nombre et la complexité des étapes.

Réponds avec un JSON :
{
  "title": "...", "subtitle": "...", "description": "...", "pedagogicalGoal": "...",
  "ageRange": "${o.ageRange}", "durationMinutes": 30, "difficulty": 2, "category": "${o.concept.category}", "tags": ["..."],
  "materials": [{ "name": "...", "quantity": "...", "optional": false, "note": "..." }],
  "steps": [{ "title": "...", "instruction": "...", "tip": "...", "adultHelp": false, "illustrationBrief": "..." }],
  "finalIllustrationBrief": "...",
  "explanation": { "title": "...", "body": "...", "keyWords": ["..."] },
  "challenge": { "title": "...", "body": "..." },
  "safety": { "adultSupervision": "none|recommended|required", "warnings": ["..."], "hazards": ["tools","small_parts","substances","heat","electricity","sharp","water","allergens","other"] },
  "funFact": "..."
}`;
}

export function visualReferencePrompt(content: ActivityContent, artStyle: string) {
  return `À partir de la fiche d'activité ci-dessous, rédige une FICHE DE RÉFÉRENCE VISUELLE qui servira à générer des illustrations cohérentes entre elles (même objet, mêmes couleurs, mêmes personnages à chaque étape).

Style graphique du livre : ${ART_STYLES.find((s) => s.key === artStyle)?.label ?? artStyle}

Fiche :
Titre : ${content.title}
Objet final : ${content.finalIllustrationBrief}
Matériel : ${content.materials.map((m) => m.name).join(", ")}
Étapes :
${content.steps.map((s, i) => `${i + 1}. ${s.title} — ${s.illustrationBrief}`).join("\n")}

Réponds avec un JSON :
{
  "finalObject": "description précise de l'objet final",
  "shape": "forme générale et proportions",
  "colors": ["couleur de chaque élément"],
  "materials": ["..."],
  "dimensions": "dimensions approximatives",
  "mainParts": [{ "name": "...", "appearance": "..." }],
  "characters": "personnage(s) récurrent(s) et apparence constante, ou vide",
  "setting": "décor constant",
  "stepAppearances": [{ "stepIndex": 0, "appearance": "état de l'objet à la fin de cette étape" }],
  "styleNotes": "cadrage, point de vue, fond",
  "negativePrompt": "éléments à éviter"
}`;
}

export function coverPrompt(o: { title: string; subtitle?: string; ageRange: string; count: number; activityTitles: string[]; collection?: string; bookType: string }) {
  return `Rédige les textes de couverture d'un livre d'activités pour enfants.

Titre : ${o.title}
Sous-titre : ${o.subtitle ?? ""}
Collection : ${o.collection ?? ""}
Type : ${o.bookType} — Public : ${ageRangeLabel(o.ageRange)} — ${o.count} activités
Activités : ${o.activityTitles.slice(0, 12).join(" ; ")}

Réponds avec un JSON :
{
  "title": "${o.title}", "subtitle": "...", "collection": "${o.collection ?? ""}", "ageLabel": "${ageRangeLabel(o.ageRange)}",
  "tagline": "accroche courte de couverture",
  "backText": "texte de quatrième de couverture (60 à 120 mots) adressé aux parents et aux enfants",
  "backBullets": ["3 à 4 points forts"],
  "illustrationBrief": "description de l'illustration principale de couverture, sans texte dans l'image",
  "variant": 0
}`;
}

// ---------------------------------------------------------------------------
// Prompts d'illustration
// ---------------------------------------------------------------------------

function styleClause(artStyle: string) {
  return ART_STYLES.find((s) => s.key === artStyle)?.prompt ?? ART_STYLES[0].prompt;
}

export function finalIllustrationPrompt(content: ActivityContent, ref: VisualReferenceSheet | null, artStyle: string) {
  return [
    `Children's activity book illustration, ${styleClause(artStyle)}.`,
    `Subject: ${content.finalIllustrationBrief}`,
    ref ? `Reference sheet — object: ${ref.finalObject}. Shape: ${ref.shape}. Colors: ${ref.colors.join(", ")}. Materials: ${ref.materials.join(", ")}. Parts: ${ref.mainParts.map((p) => `${p.name} (${p.appearance})`).join("; ")}. Setting: ${ref.setting}. ${ref.characters ? `Characters: ${ref.characters}.` : ""} ${ref.styleNotes}` : "",
    "No text, no letters, no logos, no watermark. Single clear subject, child-friendly, print quality.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function stepIllustrationPrompt(content: ActivityContent, stepIndex: number, ref: VisualReferenceSheet | null, artStyle: string) {
  const step = content.steps[stepIndex];
  const appearance = ref?.stepAppearances.find((s) => s.stepIndex === stepIndex)?.appearance;
  return [
    `Children's activity book step illustration (step ${stepIndex + 1} of ${content.steps.length}), ${styleClause(artStyle)}.`,
    `Show exactly: ${step.illustrationBrief}`,
    appearance ? `State of the object at the end of this step: ${appearance}` : "",
    ref ? `Keep consistent with the reference: object ${ref.finalObject}; colors ${ref.colors.join(", ")}; materials ${ref.materials.join(", ")}; setting ${ref.setting}. ${ref.characters ? `Characters: ${ref.characters}.` : ""}` : "",
    "Same object, same colors and same characters as the other steps. No text, no numbers, no letters, no logos. Clear instructional composition.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function coverIllustrationPrompt(brief: string, artStyle: string, variant: number) {
  const moods = ["warm and joyful, golden light", "bright and energetic, bold composition", "calm and curious, soft morning light", "playful and dynamic, lots of movement"];
  return `Children's book front cover illustration, ${styleClause(artStyle)}. ${brief}. Mood: ${moods[variant % moods.length]}. Leave clean space at the top for the title. No text, no letters, no logos.`;
}

export function negativeFor(ref: VisualReferenceSheet | null) {
  return ["text, letters, numbers, watermark, logo, extra limbs, deformed hands, blurry, photo-realistic gore", ref?.negativePrompt ?? ""].filter(Boolean).join(", ");
}
