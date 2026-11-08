import type { z } from "zod";
import { ActivityContentSchema, BookOutlineSchema, CoverDataSchema, VisualReferenceSheetSchema } from "../schemas/activity";
import { GuideSchema, KitPlanSchema, PranksKitSchema, RecipesSchema, ScienceSchema, TreasureHuntSchema } from "../kits/schemas";

/** Schémas de validation des réponses collées, par finalité (les mêmes que ceux du mode API). */
export const MANUAL_SCHEMA_BY_PURPOSE: Record<string, { name: string; schema: z.ZodTypeAny }> = {
  outline: { name: "BookOutline", schema: BookOutlineSchema },
  activity: { name: "ActivityContent", schema: ActivityContentSchema },
  visual_reference: { name: "VisualReferenceSheet", schema: VisualReferenceSheetSchema },
  cover: { name: "CoverData", schema: CoverDataSchema },
  kit_hunt: { name: "TreasureHunt", schema: TreasureHuntSchema },
  kit_pranks: { name: "PranksKit", schema: PranksKitSchema },
  kit_guide: { name: "Guide", schema: GuideSchema },
  kit_recipes: { name: "Recipes", schema: RecipesSchema },
  kit_science: { name: "Science", schema: ScienceSchema },
  kit_plan: { name: "KitPlan", schema: KitPlanSchema },
};

export function schemaByName(name: string | null | undefined): z.ZodTypeAny | null {
  if (!name) return null;
  return Object.values(MANUAL_SCHEMA_BY_PURPOSE).find((s) => s.name === name)?.schema ?? null;
}
