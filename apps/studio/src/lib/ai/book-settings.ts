/**
 * Réglages IA effectifs d'un livre (purs, testables) : Paramètres → IA, puis réglages du
 * type (cahier de coloriage : gpt-image-1-mini, qualité medium, sans esquisse), puis
 * surcharges du livre (mode mixte, modèle, qualité…).
 */
import type { AiSettings } from "../schemas/settings";
import { KitCustomizationSchema, type BookAiOverrides } from "../kits/schemas";
import { kitType } from "../kits/types";

export function isColoringKit(kitTypeKey: string | null | undefined): boolean {
  return kitType(kitTypeKey).format === "coloring";
}

export function bookAiOverrides(customization: unknown): BookAiOverrides {
  const c = KitCustomizationSchema.safeParse(customization ?? {});
  return (c.success ? c.data.ai : undefined) ?? {};
}

function withVia(base: AiSettings, o: BookAiOverrides): AiSettings {
  const manualT = base.mode === "manual" && base.manualFor !== "images";
  const manualI = base.mode === "manual" && base.manualFor !== "text";
  const t = o.textVia ? o.textVia === "manual" : manualT;
  const i = o.imagesVia ? o.imagesVia === "manual" : manualI;
  const s = { ...base, mode: t || i ? "manual" : "api", manualFor: t && i ? "all" : t ? "text" : "images" } as AiSettings;
  if (o.imagesVia === "api" && s.imageProvider === "mock") s.imageProvider = "openai";
  return s;
}

/** Réglages des illustrations intérieures du livre. */
export function bookImageSettings(base: AiSettings, book: { kitType: string; customization?: unknown }): AiSettings {
  const o = bookAiOverrides(book.customization);
  let s = withVia(base, o);
  if (isColoringKit(book.kitType)) s = { ...s, imageModel: base.coloring.imageModel, imageQuality: base.coloring.imageQuality, sketchMode: base.coloring.sketch };
  if (o.imageModel) s.imageModel = o.imageModel;
  if (o.imageQuality) s.imageQuality = o.imageQuality;
  if (o.sketch !== undefined) s.sketchMode = o.sketch;
  return s;
}

/** Réglages de la couverture (en couleur : modèle et qualité supérieurs pour un cahier de coloriage). */
export function bookCoverSettings(base: AiSettings, book: { kitType: string; customization?: unknown }): AiSettings {
  const o = bookAiOverrides(book.customization);
  let s = withVia(base, o);
  if (isColoringKit(book.kitType)) s = { ...s, imageModel: base.coloring.coverModel, imageQuality: base.coloring.coverQuality, sketchMode: false };
  if (o.coverModel) s.imageModel = o.coverModel;
  if (o.coverQuality) s.imageQuality = o.coverQuality;
  return s;
}

/** Réglages de la rédaction (mode mixte : texte en copier-coller même si les images passent par l'API). */
export function bookTextSettings(base: AiSettings, book: { customization?: unknown }): AiSettings {
  return withVia(base, bookAiOverrides(book.customization));
}

/** Le livre utilise-t-il un vrai fournisseur d'images (API ou copier-coller) ? */
export function realImageProvider(s: AiSettings): boolean {
  return s.imageProvider !== "mock" || (s.mode === "manual" && s.manualFor !== "text");
}

/** Réglages à passer à l'estimation de coût : images et couverture effectives du livre. */
export function effectiveEstimateSettings(base: AiSettings, book: { kitType: string; customization?: unknown }): AiSettings {
  const img = bookImageSettings(base, book);
  const cover = bookCoverSettings(base, book);
  return { ...img, coloring: { imageModel: img.imageModel, imageQuality: img.imageQuality, sketch: img.sketchMode, coverModel: cover.imageModel, coverQuality: cover.imageQuality } };
}
