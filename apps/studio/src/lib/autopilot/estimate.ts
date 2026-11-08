/**
 * Estimation du coût d'un run du pilote automatique, étape par étape (pure, testable).
 * Ordres de grandeur : tokens moyens observés pour les kits, tarifs de src/lib/ai/pricing.ts,
 * coût Runway par seconde des réglages vidéo. Le mode copier-coller et le mode démo coûtent 0.
 */
import { imageCost, textCost } from "../ai/pricing";
import type { AiSettings, AutopilotSettings, AutopilotStageKey } from "../schemas/settings";
import type { KitContentFormat } from "../kits/schemas";

export interface EstimateInput {
  format: KitContentFormat;
  count: number;
  /** Le contenu complet est déjà fourni (JSON collé) : pas de rédaction ni de plan par l'IA */
  contentProvided: boolean;
  ai: Pick<AiSettings, "mode" | "manualFor" | "textProvider" | "textModel" | "imageProvider" | "imageModel" | "imageQuality"> & Partial<Pick<AiSettings, "sketchQuality">>;
  autopilot: Pick<AutopilotSettings, "stages" | "videoFormats" | "clipProvider" | "clipDurationSeconds"> & Partial<Pick<AutopilotSettings, "sketchFirst">>;
  runwayUsdPerSecond: number;
}

export interface CostEstimate {
  stages: Partial<Record<AutopilotStageKey, number>>;
  totalUsd: number;
  images: number;
  notes: string[];
}

/** Tokens moyens (entrée, sortie) par appel texte. */
const TOKENS = {
  plan: [2500, 1200],
  treasure_hunt: [6000, 14000],
  pranks: [8000, 24000],
  guide: [7000, 22000],
  recipes: [6000, 20000],
  science: [6000, 16000],
  ads: [3000, 3500],
} as const;

/** Nombre d'illustrations d'un kit hors planche : emplacements fixes + éléments + 2 visuels marketing + couverture. */
export function illustrationCount(format: KitContentFormat, count: number): number {
  // Emplacements fixes : lettre, carte, diplôme, invitation | arrivée, départ, certificat | problème (guide) | aucun (recettes) | diplôme (sciences)
  const fixed = { treasure_hunt: 4, pranks: 3, guide: 1, recipes: 0, science: 1 }[format];
  return fixed + count + 2 + 1;
}

export function estimateRun(input: EstimateInput): CostEstimate {
  const { ai, autopilot } = input;
  const manualTextOn = ai.mode === "manual" && ai.manualFor !== "images";
  const manualImagesOn = ai.mode === "manual" && ai.manualFor !== "text";
  const text = (inTok: number, outTok: number) => (manualTextOn || ai.textProvider === "mock" ? 0 : textCost(ai.textModel, inTok, outTok));
  const perImage = (size: string) => (manualImagesOn || ai.imageProvider === "mock" ? 0 : imageCost(ai.imageModel, ai.imageQuality, size));
  // Mode esquisse : une esquisse (qualité basse) + la version finale de chaque image validée
  const sketchOn = autopilot.sketchFirst !== false && !manualImagesOn;
  const perSketch = (size: string) => (sketchOn && ai.imageProvider !== "mock" ? imageCost(ai.imageModel, ai.sketchQuality ?? "low", size) : 0);
  const notes: string[] = [];
  const stages: CostEstimate["stages"] = {};

  stages.plan = input.contentProvided ? 0 : text(TOKENS.plan[0], TOKENS.plan[1]);
  const [cin, cout] = TOKENS[input.format];
  stages.content = input.contentProvided ? 0 : text(cin, cout);
  stages.quality = 0;
  stages.character = autopilot.stages.character !== false ? perImage("1024x1024") : 0;
  const nImages = illustrationCount(input.format, input.count);
  stages.illustrations = round(nImages * (perImage("1024x1024") + perSketch("1024x1024")));
  stages.layout = 0;
  stages.pdf = 0;
  stages.publish = 0;
  const clipOn = autopilot.stages.video !== false && autopilot.clipProvider === "runway";
  stages.video = clipOn ? round(autopilot.videoFormats.length * autopilot.clipDurationSeconds * input.runwayUsdPerSecond) : 0;
  stages.ads = autopilot.stages.ads !== false ? text(TOKENS.ads[0], TOKENS.ads[1]) : 0;

  if (manualTextOn) notes.push("Textes en mode copier-coller : aucun coût API (prompts à coller dans Claude ou ChatGPT).");
  if (manualImagesOn) notes.push("Images en mode copier-coller : aucun coût API (images à générer dans ChatGPT puis à téléverser).");
  if (!manualTextOn && ai.textProvider === "mock") notes.push("Fournisseur texte de démonstration : textes fictifs, coût nul.");
  if (!manualImagesOn && ai.imageProvider === "mock") notes.push("Fournisseur d'images de démonstration : images étiquetées « DÉMO », coût nul.");
  if (sketchOn && ai.imageProvider !== "mock") notes.push(`Mode esquisse : ${nImages} esquisse(s) à ${perSketch("1024x1024").toFixed(3)} $ puis version finale des images validées (les images refusées ne sont pas payées en qualité finale).`);
  if (clipOn) notes.push(`Clip Runway : ${autopilot.videoFormats.length} format(s) × ${autopilot.clipDurationSeconds} s.`);
  if (stages.ads) notes.push("Publicités : textes générés par la boutique si elle a une clé Claude, sinon par le studio (coût indiqué).");

  const totalUsd = round(Object.values(stages).reduce((a, b) => a + (b ?? 0), 0));
  return { stages, totalUsd, images: nImages + (autopilot.stages.character !== false ? 1 : 0), notes };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
