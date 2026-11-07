import type { ActivityConcept, ActivityContent, VisualReferenceSheet, CoverData, BookOutline } from "../../schemas/activity";
import { DEMO_CONCEPTS, PILOT_ACTIVITY, PILOT_VISUAL_REFERENCE } from "../../demo/petits-inventeurs";

const BANK: Record<string, ActivityConcept[]> = {
  inventions: DEMO_CONCEPTS,
  sciences: [
    c("Le volcan qui entre en éruption", "Un volcan en pâte à sel qui crache une mousse rouge.", "sciences", "Volcan en pâte à sel avec mousse rouge", "Réaction acide-base", 2, 40, ["bicarbonate", "vinaigre", "colorant", "pâte à sel"]),
    c("L'arc-en-ciel dans un verre", "Des couches de liquides colorés qui ne se mélangent pas.", "sciences", "Verre avec 4 couches colorées", "La densité des liquides", 2, 30, ["miel", "eau", "huile", "colorant", "verre"]),
    c("Le nuage dans une bouteille", "Un vrai nuage qui apparaît dans une bouteille.", "sciences", "Bouteille transparente contenant un nuage blanc", "Condensation de la vapeur d'eau", 3, 25, ["bouteille", "eau chaude", "allumette", "glaçons"]),
    c("La boussole flottante", "Une aiguille aimantée qui indique le nord sur un bouchon.", "sciences", "Aiguille sur un bouchon flottant dans un bol", "Le magnétisme terrestre", 2, 25, ["aiguille", "aimant", "bouchon de liège", "bol d'eau"]),
    c("L'œuf qui rebondit", "Un œuf dont la coquille a disparu dans le vinaigre.", "sciences", "Œuf translucide et souple", "Dissolution du calcaire par l'acide", 1, 20, ["œuf", "vinaigre", "bocal"]),
  ],
  bricolage: [
    c("La mangeoire à oiseaux", "Une mangeoire en brique de lait pour nourrir les oiseaux du jardin.", "bricolage", "Brique de lait découpée avec perchoir", "Protéger la nature", 2, 40, ["brique de lait", "ciseaux", "ficelle", "graines"]),
    c("Le pot à crayons monstre", "Un pot à crayons rigolo décoré en monstre.", "bricolage", "Boîte de conserve décorée en monstre", "Recyclage créatif", 1, 30, ["boîte de conserve", "papier", "colle", "yeux mobiles"]),
    c("La marionnette à chaussette", "Une marionnette qui parle fabriquée avec une chaussette.", "bricolage", "Chaussette avec yeux et langue en feutrine", "Expression et imagination", 1, 30, ["chaussette", "feutrine", "colle", "boutons"]),
  ],
};
BANK.creativite = BANK.bricolage;
BANK.nature = BANK.sciences;
BANK.jeux = BANK.inventions;
BANK.prescolaire = BANK.bricolage;

function c(title: string, summary: string, category: string, finalObject: string, mainConcept: string, difficulty: number, durationMinutes: number, keyMaterials: string[]): ActivityConcept {
  return { title, summary, category, finalObject, mainConcept, difficulty, durationMinutes, keyMaterials };
}

export function mockOutline(ctx: Record<string, string>): BookOutline {
  const count = Number(ctx.count ?? 10);
  const category = ctx.category ?? "inventions";
  const bank = BANK[category] ?? DEMO_CONCEPTS;
  const activities: ActivityConcept[] = [];
  for (let i = 0; i < count; i++) {
    const base = bank[i % bank.length];
    const round = Math.floor(i / bank.length);
    activities.push(round === 0 ? base : { ...base, title: `${base.title} (variante ${round + 1})` });
  }
  return {
    title: ctx.title || "Mon livre d'activités",
    subtitle: ctx.subtitle || `${count} activités à réaliser`,
    introduction:
      "Bienvenue dans ce livre d'activités ! Chaque fiche te guide pas à pas, du matériel à rassembler jusqu'au résultat final, et t'explique le secret qui se cache derrière chaque expérience. (Contenu de démonstration généré hors ligne.)",
    activities,
  };
}

export function mockActivity(ctx: Record<string, string>): ActivityContent {
  const title = ctx.title ?? "Activité de démonstration";
  if (title.toLowerCase().includes("voiture propulsée par un ballon")) return PILOT_ACTIVITY;
  const ageRange = (ctx.ageRange as ActivityContent["ageRange"]) ?? "6-9";
  const materials = (ctx.keyMaterials ?? "carton, ciseaux, colle").split(",").map((m) => m.trim()).filter(Boolean);
  const obj = ctx.finalObject || "l'objet final";
  const steps = [
    ["Rassemble le matériel", `Pose tout le matériel sur la table : ${materials.join(", ")}. Vérifie qu'il ne manque rien avant de commencer.`],
    ["Prépare les pièces", `Découpe et prépare chaque élément nécessaire pour fabriquer ${obj}. Travaille lentement et proprement.`],
    ["Assemble", `Assemble les pièces les unes aux autres avec ${materials[materials.length - 1] ?? "de la colle"} pour obtenir ${obj}.`],
    ["Teste et observe", `Teste ton invention. Observe bien ce qui se passe : c'est là que se cache le secret de ${ctx.mainConcept ?? "cette activité"}.`],
  ];
  return {
    title,
    subtitle: ctx.summary ?? "",
    description: `${ctx.summary ?? "Une activité passionnante."} Dans cette activité, tu vas fabriquer ${obj} et découvrir ${ctx.mainConcept ?? "un phénomène étonnant"}. (Contenu de démonstration généré hors ligne, à remplacer par une génération réelle.)`,
    pedagogicalGoal: `Découvrir ${ctx.mainConcept ?? "un phénomène scientifique"} par l'expérimentation et développer la motricité fine et l'autonomie.`,
    ageRange,
    durationMinutes: Number(ctx.durationMinutes ?? 30),
    difficulty: Number(ctx.difficulty ?? 2),
    category: ctx.category ?? "sciences",
    tags: ["démo"],
    materials: materials.map((name) => ({ name, quantity: "1", optional: false, note: "" })),
    steps: steps.map(([t, i], idx) => ({
      title: t,
      instruction: i,
      tip: idx === 1 ? "Demande de l'aide si le découpage est difficile." : "",
      adultHelp: idx === 1,
      illustrationBrief: `Étape ${idx + 1} de la fabrication de ${obj} : ${t.toLowerCase()}, matériel visible sur une table en bois clair.`,
    })),
    finalIllustrationBrief: `${obj}, terminé, posé sur une table en bois clair, vue de trois quarts, fond simple.`,
    explanation: {
      title: "Comment ça marche ?",
      body: `Le secret de cette activité, c'est ${ctx.mainConcept ?? "un phénomène physique"}. Quand tu réalises l'expérience, tu observes directement ce phénomène. Les scientifiques l'ont étudié pendant des siècles, et toi, tu viens de le reproduire chez toi avec des objets du quotidien ! Ce texte est un contenu de démonstration qui sera remplacé par une explication détaillée lors d'une génération réelle.`,
      keyWords: [(ctx.mainConcept ?? "science").slice(0, 40)],
    },
    challenge: { title: "Pour aller plus loin", body: "Modifie un élément de ton invention (taille, matériau, forme) et compare le résultat avec la première version. Note tes observations dans un carnet." },
    safety: { adultSupervision: "recommended", warnings: ["Utilise des ciseaux à bouts ronds.", "Demande l'aide d'un adulte pour les découpes difficiles."], hazards: ["sharp"] },
    funFact: "",
  };
}

export function mockVisualReference(ctx: Record<string, string>): VisualReferenceSheet {
  const title = ctx.title ?? "";
  if (title.toLowerCase().includes("voiture propulsée par un ballon")) return PILOT_VISUAL_REFERENCE;
  const steps = Number(ctx.stepCount ?? 4);
  return {
    finalObject: ctx.finalObject ?? "Objet final de l'activité",
    shape: "Forme simple et reconnaissable, proportions constantes",
    colors: ["carton beige", "accents rouges", "détails bleus"],
    materials: (ctx.keyMaterials ?? "carton").split(",").map((m) => m.trim()),
    dimensions: "Environ 15 à 20 cm",
    mainParts: [{ name: "Corps principal", appearance: "Élément central en carton beige" }],
    characters: "Un enfant de 7 ans, t-shirt vert",
    setting: "Table en bois clair, pièce lumineuse",
    stepAppearances: Array.from({ length: steps }, (_, i) => ({ stepIndex: i, appearance: `État de l'objet après l'étape ${i + 1}` })),
    styleNotes: "Fond simple, objet centré, pas de texte",
    negativePrompt: "texte, logos, mains déformées",
  };
}

export function mockCover(ctx: Record<string, string>): CoverData {
  return {
    title: ctx.title ?? "Mon livre",
    subtitle: ctx.subtitle ?? "",
    collection: ctx.collection ?? "Inventor Studio",
    ageLabel: ctx.ageLabel ?? "",
    tagline: "Construis, teste, comprends !",
    backText: `Ce livre rassemble ${ctx.count ?? "des"} activités à réaliser à la maison ou en classe, avec des objets du quotidien. Chaque activité est expliquée pas à pas et illustrée. (Texte de démonstration.)`,
    backBullets: ["Des étapes illustrées", "Le secret scientifique expliqué", "Des défis pour aller plus loin"],
    illustrationBrief: "Des enfants souriants entourés de leurs créations dans un atelier lumineux.",
    variant: 0,
  };
}
