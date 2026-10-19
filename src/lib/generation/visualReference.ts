import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getTextProvider, effectiveTextModel } from "../ai/registry";
import { generateStructured, contextBlock } from "../ai/structured";
import { VisualReferenceSheetSchema, type VisualReferenceSheet } from "../schemas/activity";
import { SYSTEM_EDITOR, visualReferencePrompt } from "./prompts";
import { getActivityContent } from "./activity";

export async function generateVisualReference(activityId: string, opts?: { jobId?: string; bookId?: string; artStyle?: string }) {
  const content = await getActivityContent(activityId);
  if (!content) throw new Error("La fiche de l'activité doit être rédigée avant la fiche de référence visuelle");
  const settings = await getAiSettings();
  const provider = getTextProvider(settings);
  const artStyle = opts?.artStyle ?? (await bookArtStyle(activityId));
  const prompt =
    visualReferencePrompt(content, artStyle) +
    "\n\n" +
    contextBlock("visual_reference", { title: content.title, finalObject: content.finalIllustrationBrief, keyMaterials: content.materials.map((m) => m.name).join(", "), stepCount: content.steps.length });
  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: VisualReferenceSheetSchema, system: SYSTEM_EDITOR, prompt, purpose: "visual_reference", activityId, bookId: opts?.bookId, jobId: opts?.jobId });
  await saveVisualReference(activityId, res.data);
  return { sheet: res.data, usage: res.usage };
}

export async function saveVisualReference(activityId: string, sheet: VisualReferenceSheet) {
  const data = VisualReferenceSheetSchema.parse(sheet);
  return prisma.visualReference.upsert({
    where: { activityId },
    create: { activityId, data },
    update: { data, version: { increment: 1 } },
  });
}

export async function getVisualReference(activityId: string): Promise<VisualReferenceSheet | null> {
  const row = await prisma.visualReference.findUnique({ where: { activityId } });
  if (!row) return null;
  const p = VisualReferenceSheetSchema.safeParse(row.data);
  return p.success ? p.data : null;
}

export async function bookArtStyle(activityId: string) {
  const link = await prisma.bookActivity.findFirst({ where: { activityId }, include: { book: true } });
  return link?.book.artStyle ?? "aquarelle";
}
