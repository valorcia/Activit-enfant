"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { enqueue, QUEUES } from "@/lib/queue/jobs";
import { ActivityConceptSchema, ActivityContentSchema, VisualReferenceSheetSchema } from "@/lib/schemas/activity";
import { saveActivityVersion } from "@/lib/generation/activity";
import { saveVisualReference } from "@/lib/generation/visualReference";
import { reviewIllustration } from "@/lib/generation/illustration";
import { runActivityChecks } from "@/lib/quality/checks";
import { uniqueSlug } from "@/lib/generation/outline";
import type { IllustrationKind } from "@prisma/client";

export async function createActivityConcept(input: { concept: unknown; ageRange: string; bookId?: string }) {
  const concept = ActivityConceptSchema.parse(input.concept);
  const activity = await prisma.activity.create({
    data: { slug: await uniqueSlug(prisma, concept.title), title: concept.title, category: concept.category, ageRange: input.ageRange, difficulty: concept.difficulty, durationMinutes: concept.durationMinutes, status: "CONCEPT", concept },
  });
  if (input.bookId) {
    const count = await prisma.bookActivity.count({ where: { bookId: input.bookId } });
    await prisma.bookActivity.create({ data: { bookId: input.bookId, activityId: activity.id, position: count } });
  }
  revalidatePath("/library");
  return activity.id;
}

export async function generateActivity(activityId: string) {
  const link = await prisma.bookActivity.findFirst({ where: { activityId } });
  const job = await enqueue(QUEUES.activityGenerate, { activityId, bookId: link?.bookId });
  return { jobId: job.id };
}

export async function illustrateActivity(activityId: string) {
  const link = await prisma.bookActivity.findFirst({ where: { activityId } });
  const job = await enqueue(QUEUES.activityIllustrate, { activityId, bookId: link?.bookId });
  return { jobId: job.id };
}

export async function regenerateIllustration(activityId: string, kind: IllustrationKind, stepIndex?: number) {
  const link = await prisma.bookActivity.findFirst({ where: { activityId } });
  const job = await enqueue(QUEUES.illustrationSingle, { activityId, bookId: link?.bookId, kind, stepIndex });
  return { jobId: job.id };
}

export async function reviewIllustrationAction(illustrationId: string, decision: "ACCEPTED" | "REJECTED", note?: string) {
  const ill = await reviewIllustration(illustrationId, decision, note);
  if (ill.activityId) await runActivityChecks(ill.activityId);
  revalidatePath(`/activities/${ill.activityId}`);
}

export async function saveActivityContent(activityId: string, content: unknown, note?: string) {
  const parsed = ActivityContentSchema.parse(content);
  await saveActivityVersion(activityId, parsed, { source: "manual", note: note ?? "Modification manuelle" });
  revalidatePath(`/activities/${activityId}`);
}

export async function restoreActivityVersion(activityId: string, versionId: string) {
  const v = await prisma.activityVersion.findUniqueOrThrow({ where: { id: versionId } });
  await saveActivityVersion(activityId, ActivityContentSchema.parse(v.content), { source: "manual", note: `Restauration de la version ${v.number}` });
  revalidatePath(`/activities/${activityId}`);
}

export async function saveVisualReferenceAction(activityId: string, sheet: unknown) {
  await saveVisualReference(activityId, VisualReferenceSheetSchema.parse(sheet));
  revalidatePath(`/activities/${activityId}`);
}

export async function setActivityStatus(activityId: string, status: "VALIDATED" | "REVIEW" | "ARCHIVED") {
  const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId } });
  if (status === "VALIDATED") {
    if (!a.currentVersionId) throw new Error("Impossible de valider une activité sans fiche.");
    const blockers = await prisma.qualityIssue.count({ where: { activityId, severity: "BLOCKER", resolved: false } });
    // La validation humaine lève le blocage sécurité : on l'enregistre explicitement
    await prisma.activity.update({ where: { id: activityId }, data: { status: "VALIDATED", validatedAt: new Date(), safetyBlocked: false, safetyNotes: blockers ? `${a.safetyNotes ?? ""}\nRisques examinés et validés manuellement le ${new Date().toLocaleDateString("fr-FR")}.` : a.safetyNotes } });
    await prisma.qualityIssue.updateMany({ where: { activityId, severity: "BLOCKER" }, data: { resolved: true } });
  } else {
    await prisma.activity.update({ where: { id: activityId }, data: { status, validatedAt: status === "REVIEW" ? null : undefined } });
  }
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/library");
}

export async function duplicateActivity(activityId: string) {
  const a = await prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { currentVersion: true, visualRef: true } });
  const title = `${a.title} (copie)`;
  const copy = await prisma.activity.create({
    data: { slug: await uniqueSlug(prisma, title), title, category: a.category, ageRange: a.ageRange, difficulty: a.difficulty, durationMinutes: a.durationMinutes, status: a.currentVersion ? "REVIEW" : "CONCEPT", concept: a.concept ?? undefined, tags: a.tags },
  });
  if (a.currentVersion) {
    const content = ActivityContentSchema.parse(a.currentVersion.content);
    await saveActivityVersion(copy.id, { ...content, title }, { source: "manual", note: `Dupliquée depuis ${a.title}` });
  }
  if (a.visualRef) await saveVisualReference(copy.id, VisualReferenceSheetSchema.parse(a.visualRef.data));
  revalidatePath("/library");
  return copy.id;
}

export async function recheckActivity(activityId: string) {
  await runActivityChecks(activityId, { requireSteps: true });
  revalidatePath(`/activities/${activityId}`);
}

export async function resolveIssue(issueId: string) {
  await prisma.qualityIssue.update({ where: { id: issueId }, data: { resolved: true } });
}

export async function deleteActivity(activityId: string) {
  await prisma.activity.delete({ where: { id: activityId } });
  revalidatePath("/library");
}
