/**
 * Estimation du coût d'un run du pilote automatique, étape par étape (pure, testable).
 * Ordres de grandeur : tokens moyens observés pour les kits, tarifs de src/lib/ai/pricing.ts,
 * coût Runway par seconde des réglages vidéo. Le mode copier-coller et le mode démo coûtent 0.
 */
import { imageCost, textCost } from "../ai/pricing";
import type { AiSettings, AutopilotSettings, AutopilotStageKey } from "../schemas/settings";
import type { KitContentFormat } from "../kits/schemas";
import { BATCH_SIZE, BATCH_THRESHOLD } from "../kits/limits";

export interface EstimateInput {
  format: KitContentFormat;
  count: number;
  /** Le contenu complet est déjà fourni (JSON collé) : pas de rédaction ni de plan par l'IA */
  contentProvided: boolean;
  ai: Pick<AiSettings, "mode" | "manualFor" | "textProvider" | "textModel" | "imageProvider" | "imageModel" | "imageQuality"> & Partial<Pick<AiSettings, "sketchQuality" | "coloring">>;
  autopilot: Pick<AutopilotSettings, "stages" | "videoFormats" | "clipProvider" | "clipDurationSeconds"> & Partial<Pick<AutopilotSettings, "sketchFirst" | "etsyState">>;
  runwayUsdPerSecond: number;
}

export interface CostEstimate {
  stages: Partial<Record<AutopilotStageKey, number>>;
  totalUsd: number;
  images: number;
  notes: string[];
  /** Détail lisible du calcul, par étape (affiché avec le plafond de coût) */
  lines: Partial<Record<AutopilotStageKey, string>>;
  /** Prix unitaire d'une image intérieure (version finale) */
  imageUnitUsd: number;
}

/** Frais Etsy de mise en vente d'une fiche (USD). */
export const ETSY_LISTING_FEE_USD = 0.2;

/** Tokens moyens (entrée, sortie) par appel texte. */
const TOKENS = {
  plan: [2500, 1200],
  treasure_hunt: [6000, 14000],
  pranks: [8000, 24000],
  guide: [7000, 22000],
  recipes: [6000, 20000],
  science: [6000, 16000],
  coloring: [4000, 6000],
  ads: [3000, 3500],
} as const;

/** Nombre d'éléments correspondant aux tokens moyens ci-dessus (pour l'extrapolation). */
const TOKENS_FOR: Record<KitContentFormat, number> = { treasure_hunt: 10, pranks: 30, guide: 8, recipes: 12, science: 12, coloring: 30 };
/** Part des tokens de sortie qui ne dépend pas du nombre d'éléments (lettres, guide, fiche boutique). */
const FRAME_SHARE = 0.3;

/** Tokens de rédaction (entrée, sortie, appels) : extrapolés au nombre d'éléments, avec le surcoût des lots. */
export function contentTokens(format: KitContentFormat, count: number): { input: number; output: number; calls: number } {
  const [cin, cout] = TOKENS[format];
  const perItem = (cout * (1 - FRAME_SHARE)) / TOKENS_FOR[format];
  const output = Math.round(cout * FRAME_SHARE + perItem * count);
  if (count <= BATCH_THRESHOLD) return { input: cin, output, calls: 1 };
  const batches = Math.ceil(count / BATCH_SIZE);
  // Sommaire (≈ 60 tokens par titre) + un prompt complet par lot (contexte commun répété)
  return { input: cin * batches + 3000, output: output + count * 60, calls: batches + 1 };
}

/** Nombre d'illustrations d'un kit hors planche : emplacements fixes + éléments + 2 visuels marketing + couverture. */
export function illustrationCount(format: KitContentFormat, count: number): number {
  // Emplacements fixes : lettre, carte, diplôme, invitation | arrivée, départ, certificat | problème (guide) | aucun (recettes) | diplôme (sciences)
  // Coloriage : page d'exemple colorée
  const fixed = { treasure_hunt: 4, pranks: 3, guide: 1, recipes: 0, science: 1, coloring: 1 }[format];
  return fixed + count + 2 + 1;
}

export function estimateRun(input: EstimateInput): CostEstimate {
  const { ai, autopilot } = input;
  const coloring = input.format === "coloring";
  const manualTextOn = ai.mode === "manual" && ai.manualFor !== "images";
  const manualImagesOn = ai.mode === "manual" && ai.manualFor !== "text";
  const text = (inTok: number, outTok: number) => (manualTextOn || ai.textProvider === "mock" ? 0 : textCost(ai.textModel, inTok, outTok));
  // Cahier de coloriage : modèle et qualité propres au type (gpt-image-1-mini medium), couverture à part
  const imgModel = coloring && ai.coloring ? ai.coloring.imageModel : ai.imageModel;
  const imgQuality = coloring && ai.coloring ? ai.coloring.imageQuality : ai.imageQuality;
  const priced = !(manualImagesOn || ai.imageProvider === "mock");
  const perImage = (size: string) => (priced ? imageCost(imgModel, imgQuality, size) : 0);
  const coverUnit = priced ? (coloring && ai.coloring ? imageCost(ai.coloring.coverModel, ai.coloring.coverQuality, "1024x1024") : imageCost(ai.imageModel, ai.imageQuality, "1024x1024")) : 0;
  // Mode esquisse : une esquisse (qualité basse) + la version finale de chaque image validée ; jamais pour le coloriage par défaut
  const sketchOn = autopilot.sketchFirst !== false && !manualImagesOn && !(coloring && ai.coloring && !ai.coloring.sketch);
  const unitSize = coloring ? "1024x1536" : "1024x1024";
  const perSketch = (size: string) => (sketchOn && priced ? imageCost(imgModel, ai.sketchQuality ?? "low", size) : 0);
  const notes: string[] = [];
  const lines: CostEstimate["lines"] = {};
  const stages: CostEstimate["stages"] = {};
  const $ = (n: number) => `${n.toFixed(n < 1 ? 3 : 2)} $`;

  stages.plan = input.contentProvided ? 0 : text(TOKENS.plan[0], TOKENS.plan[1]);
  const ct = contentTokens(input.format, input.count);
  stages.content = input.contentProvided ? 0 : round(text(ct.input, ct.output));
  if (stages.content) lines.content = `${input.count} éléments : ${ct.calls} appel(s)${ct.calls > 1 ? " (sommaire + lots de " + BATCH_SIZE + ")" : ""}, ≈ ${Math.round(ct.output / 1000)} k tokens rédigés = ${$(stages.content)}`;
  stages.quality = 0;
  stages.character = autopilot.stages.character !== false && !coloring ? perImage("1024x1024") : 0;
  const nImages = illustrationCount(input.format, input.count);
  const nInterior = nImages - 1; // hors couverture
  const unit = perImage(unitSize) + perSketch(unitSize);
  stages.illustrations = round(nInterior * unit + coverUnit);
  if (priced) lines.illustrations = `${nInterior} images × ${$(perImage(unitSize))}${sketchOn ? ` + esquisse ${$(perSketch(unitSize))}` : ""} (${imgModel}, ${imgQuality}) + couverture ${$(coverUnit)} = ${$(stages.illustrations)}`;
  stages.layout = 0;
  stages.pdf = 0;
  stages.publish = 0;
  // Etsy : frais de mise en vente (0,20 $ par fiche, facturés par Etsy à l'activation), hors IA
  const etsyOn = autopilot.stages.etsy === true && autopilot.stages.publish !== false && autopilot.stages.pdf !== false;
  stages.etsy = etsyOn ? ETSY_LISTING_FEE_USD : 0;
  const clipOn = autopilot.stages.video !== false && autopilot.clipProvider === "runway";
  stages.video = clipOn ? round(autopilot.videoFormats.length * autopilot.clipDurationSeconds * input.runwayUsdPerSecond) : 0;
  stages.ads = autopilot.stages.ads !== false ? text(TOKENS.ads[0], TOKENS.ads[1]) : 0;

  if (manualTextOn) notes.push("Textes en mode copier-coller : aucun coût API (prompts à coller dans Claude ou ChatGPT).");
  if (manualImagesOn) notes.push("Images en mode copier-coller : aucun coût API (images à générer dans ChatGPT puis à téléverser).");
  if (!manualTextOn && ai.textProvider === "mock") notes.push("Fournisseur texte de démonstration : textes fictifs, coût nul.");
  if (!manualImagesOn && ai.imageProvider === "mock") notes.push("Fournisseur d'images de démonstration : images étiquetées « DÉMO », coût nul.");
  if (sketchOn && priced) notes.push(`Mode esquisse : ${nInterior} esquisse(s) à ${perSketch(unitSize).toFixed(3)} $ puis version finale des images validées (les images refusées ne sont pas payées en qualité finale).`);
  if (coloring && !sketchOn && !manualImagesOn) notes.push("Cahier de coloriage : pas d'esquisse (une esquisse coûterait presque autant qu'un dessin au trait final).");
  if (ct.calls > 1 && !input.contentProvided) notes.push(`Rédaction par lots : sommaire puis ${ct.calls - 1} lots de ${BATCH_SIZE} éléments (aucun risque de réponse tronquée, reprise lot par lot).`);
  if (clipOn) notes.push(`Clip Runway : ${autopilot.videoFormats.length} format(s) × ${autopilot.clipDurationSeconds} s.`);
  if (etsyOn) notes.push(`Etsy : ${ETSY_LISTING_FEE_USD.toFixed(2)} $ de mise en vente par fiche (${autopilot.etsyState === "active" ? "fiche activée directement" : "facturés quand vous activez le brouillon"}), puis commission Etsy sur chaque vente.`);
  if (stages.ads) notes.push("Publicités : textes générés par la boutique si elle a une clé Claude, sinon par le studio (coût indiqué).");

  const totalUsd = round(Object.values(stages).reduce((a, b) => a + (b ?? 0), 0));
  return { stages, totalUsd, images: nImages + (stages.character ? 1 : 0), notes, lines, imageUnitUsd: perImage(unitSize) };
}

/** Coût des images d'un cahier de coloriage par l'API (affiché avant lancement : « ≈ N images × prix = X $ »). */
export function coloringApiImageEstimate(ai: Pick<AiSettings, "coloring">, count: number, sampleColored = true): { images: number; unitUsd: number; coverUsd: number; totalUsd: number; label: string } {
  const unitUsd = imageCost(ai.coloring.imageModel, ai.coloring.imageQuality, "1024x1536");
  const coverUsd = imageCost(ai.coloring.coverModel, ai.coloring.coverQuality, "1024x1024");
  const images = count + (sampleColored ? 1 : 0) + 2; // dessins + exemple + 2 visuels marketing
  const totalUsd = round(images * unitUsd + coverUsd);
  return { images: images + 1, unitUsd, coverUsd, totalUsd, label: `≈ ${images} images × ${unitUsd.toFixed(3)} $ + couverture ${coverUsd.toFixed(2)} $ = ${totalUsd.toFixed(2)} $` };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
