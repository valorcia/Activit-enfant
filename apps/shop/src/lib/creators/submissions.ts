import { z } from "zod";
import type { CreatorSubmission, CreatorSubmissionStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";

/** Propositions d'idées : formulaire, photos (stockage privé), cycle de vie. */

export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 10;

export const SUBMISSION_STATUS_LABELS: Record<CreatorSubmissionStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Envoyée — en cours d'examen",
  CHANGES_REQUESTED: "Modification demandée",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
  IN_PRODUCTION: "En fabrication",
  PREVIEW_READY: "Aperçu à valider",
  APPROVED: "Aperçu validé",
  PUBLISHED: "En vente",
};

/** Statuts dans lesquels la créatrice peut encore modifier sa proposition. */
export const EDITABLE_STATUSES: CreatorSubmissionStatus[] = ["DRAFT", "CHANGES_REQUESTED"];
/** Statuts qui bloquent la mise en vente du produit lié (aperçu non encore validé). */
export const AWAITING_CREATOR_STATUSES: CreatorSubmissionStatus[] = ["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY"];

export const photoSchema = z.object({
  key: z.string().min(1).max(400),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  size: z.number().int().nonnegative().optional(),
});
export type SubmissionPhoto = z.infer<typeof photoSchema>;

export function parsePhotos(v: unknown): SubmissionPhoto[] {
  const r = z.array(photoSchema).safeParse(v);
  return r.success ? r.data : [];
}

/** Dossier privé des photos d'une créatrice : une clé d'un autre dossier est refusée. */
export function creatorPhotoFolder(creatorId: string): string {
  return `private/creators/${creatorId}/`;
}

const optInt = (min: number, max: number) => z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().int().min(min).max(max).optional());
const lines = (max: number, each: number) => z.array(z.string().trim().max(each)).transform((a) => a.filter(Boolean)).pipe(z.array(z.string()).max(max));

export const submissionInputSchema = z.object({
  title: z.string().trim().min(3, "Donnez un titre (3 caractères au moins)").max(120),
  ageMin: optInt(0, 18),
  ageMax: optInt(0, 18),
  durationMinutes: optInt(5, 600),
  materials: lines(30, 120).default([]),
  steps: lines(30, 1500).default([]),
  tips: z.string().trim().max(3000).optional().default(""),
  safetyNotes: z.string().trim().max(3000).optional().default(""),
  contribution: z.enum(["IDEA", "FULL_TUTORIAL"]).default("IDEA"),
  exclusive: z.boolean().default(false),
  photos: z.array(photoSchema).max(MAX_PHOTOS, `${MAX_PHOTOS} photos au maximum`).default([]),
}).refine((d) => d.ageMin === undefined || d.ageMax === undefined || d.ageMin <= d.ageMax, { message: "L'âge minimum doit être inférieur à l'âge maximum", path: ["ageMax"] });
export type SubmissionInput = z.infer<typeof submissionInputSchema>;

/** Contrôles supplémentaires avant l'envoi en modération. */
export function submitProblems(input: SubmissionInput): string[] {
  const out: string[] = [];
  if (input.photos.length < MIN_PHOTOS) out.push(`Ajoutez au moins ${MIN_PHOTOS} photos de votre réalisation (${input.photos.length} pour l'instant).`);
  if (input.steps.length < 1) out.push("Décrivez au moins une étape.");
  if (input.materials.length < 1) out.push("Indiquez le matériel nécessaire.");
  if (input.ageMin === undefined && input.ageMax === undefined) out.push("Indiquez l'âge conseillé.");
  return out;
}

/** Proposition liée à un produit dont la créatrice n'a pas encore validé l'aperçu. */
export async function pendingCreatorApproval(productId: string, db: PrismaClient | Prisma.TransactionClient = defaultPrisma): Promise<Pick<CreatorSubmission, "id" | "status"> | null> {
  return db.creatorSubmission.findFirst({ where: { productId, status: { in: AWAITING_CREATOR_STATUSES } }, select: { id: true, status: true } });
}

export const AWAITING_APPROVAL_MESSAGE = "Mise en vente impossible : la créatrice n'a pas encore validé l'aperçu de ce tutoriel.";

/** Produit publié : les propositions dont l'aperçu est validé passent « en vente ». */
export async function markSubmissionsPublished(productId: string, db: PrismaClient | Prisma.TransactionClient = defaultPrisma): Promise<number> {
  const r = await db.creatorSubmission.updateMany({ where: { productId, status: "APPROVED" }, data: { status: "PUBLISHED" } });
  return r.count;
}
