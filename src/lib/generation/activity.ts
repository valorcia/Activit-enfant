import { createHash } from "node:crypto";
import { prisma } from "../db";
import { getAiSettings } from "../settings";
import { getTextProvider, effectiveTextModel } from "../ai/registry";
import { generateStructured, contextBlock } from "../ai/structured";
import { ActivityContentSchema, ActivityConceptSchema, type ActivityContent } from "../schemas/activity";
import { SYSTEM_EDITOR, activityPrompt } from "./prompts";
import { runActivityChecks } from "../quality/checks";
import { assessSafety } from "../quality/safety";

/** Rédige (ou re-rédige) la fiche complète d'une activité à partir de son concept. */
export async function generateActivityContent(activityId: string, opts?: { jobId?: string; bookId?: string }) {
  const activity = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { books: { include: { book: true }, take: 1 } } });
  const concept = ActivityConceptSchema.safeParse(activity.concept);
  const base = concept.success
    ? concept.data
    : { title: activity.title, summary: activity.title, category: activity.category, finalObject: activity.title, mainConcept: activity.category, difficulty: activity.difficulty, durationMinutes: activity.durationMinutes, keyMaterials: ["carton", "ciseaux", "colle"] };
  const settings = await getAiSettings();
  const provider = getTextProvider(settings);
  const bookTitle = activity.books[0]?.book.title;

  const prompt = activityPrompt({ concept: base, ageRange: activity.ageRange, bookTitle }) + "\n\n" + contextBlock("activity", { ...base, keyMaterials: base.keyMaterials.join(", "), ageRange: activity.ageRange });
  const res = await generateStructured({ provider, model: effectiveTextModel(settings), schema: ActivityContentSchema, system: SYSTEM_EDITOR, prompt, purpose: "activity", activityId, bookId: opts?.bookId, jobId: opts?.jobId });

  await saveActivityVersion(activityId, res.data, { source: "ai", note: `Généré par ${res.provider}/${res.model}` });
  return { content: res.data, usage: res.usage };
}

/** Enregistre une nouvelle version de la fiche, met à jour l'activité, lance les contrôles. */
export async function saveActivityVersion(activityId: string, content: ActivityContent, opts: { source: string; note?: string }) {
  const parsed = ActivityContentSchema.parse(content);
  const last = await prisma.activityVersion.findFirst({ where: { activityId }, orderBy: { number: "desc" } });
  const version = await prisma.activityVersion.create({
    data: { activityId, number: (last?.number ?? 0) + 1, content: parsed, source: opts.source, note: opts.note },
  });
  const safety = assessSafety(parsed);
  const previous = await prisma.activity.findUniqueOrThrow({ where: { id: activityId } });
  const keepValidated = previous.status === "VALIDATED" && opts.source === "manual";
  await prisma.activity.update({
    where: { id: activityId },
    data: {
      currentVersionId: version.id,
      title: parsed.title,
      category: parsed.category,
      ageRange: parsed.ageRange,
      difficulty: parsed.difficulty,
      durationMinutes: parsed.durationMinutes,
      tags: parsed.tags,
      contentHash: contentHash(parsed),
      safetyBlocked: safety.blocked,
      safetyNotes: safety.notes.join("\n") || null,
      status: safety.blocked ? "BLOCKED" : keepValidated ? "VALIDATED" : "REVIEW",
      validatedAt: keepValidated ? previous.validatedAt : null,
    },
  });
  await runActivityChecks(activityId);
  return version;
}

export function contentHash(content: ActivityContent) {
  const sig = [content.title, content.materials.map((m) => m.name).join("|"), content.steps.map((s) => s.title).join("|")].join("\n").toLowerCase();
  return createHash("sha1").update(sig).digest("hex");
}

export async function getActivityContent(activityId: string): Promise<ActivityContent | null> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, include: { currentVersion: true } });
  if (!a?.currentVersion) return null;
  const parsed = ActivityContentSchema.safeParse(a.currentVersion.content);
  return parsed.success ? parsed.data : null;
}
