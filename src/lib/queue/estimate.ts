import { textCost, imageCost } from "../ai/pricing";
import { effectiveImageModel, effectiveTextModel } from "../ai/registry";
import type { AiSettings } from "../schemas/settings";

/** Estimation de coût AVANT lancement d'un lot (affichée à l'utilisateur). */
export function estimateBookCost(settings: AiSettings, o: { activities: number; averageSteps?: number; includeCover?: boolean }) {
  const tm = effectiveTextModel(settings);
  const im = effectiveImageModel(settings);
  const steps = o.averageSteps ?? 5;
  const textPerActivity = textCost(tm, 2500, 2500) + textCost(tm, 2000, 900); // fiche + référence visuelle
  const outline = textCost(tm, 1500, 400 * o.activities);
  const cover = o.includeCover ? textCost(tm, 1500, 600) + imageCost(im, settings.imageQuality, settings.imageSize) * 2 : 0;
  const imagesPerActivity = 1 + (settings.stepIllustrations ? Math.min(steps, settings.maxStepIllustrations) : 0);
  const imageUnit = imageCost(im, settings.imageQuality, settings.imageSize);
  const images = imagesPerActivity * o.activities * imageUnit;
  const text = outline + textPerActivity * o.activities;
  return {
    text,
    images,
    cover,
    total: text + images + cover,
    imagesCount: imagesPerActivity * o.activities + (o.includeCover ? 2 : 0),
    overBudget: text + images + cover > settings.maxBudgetPerBookUsd,
    budget: settings.maxBudgetPerBookUsd,
    textModel: tm,
    imageModel: im,
  };
}
