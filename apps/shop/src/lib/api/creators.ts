import type { Creator, CreatorSubmission, CreatorSubmissionStatus } from "@prisma/client";
import { signedPhotoUrls } from "@/lib/creators/photos";

/** Statuts exposés au studio (jamais les brouillons, propositions en modération ou refusées). */
export const STUDIO_STATUSES: CreatorSubmissionStatus[] = ["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY", "APPROVED", "PUBLISHED"];

type Row = CreatorSubmission & { creator: Pick<Creator, "id" | "name" | "publicName" | "slug" | "bio"> };

/** Nom affiché dans le crédit : pseudo public, sinon prénom (jamais le nom complet ni l'e-mail). */
export function creditName(c: Pick<Creator, "name" | "publicName">): string {
  return c.publicName?.trim() || c.name.trim().split(/\s+/)[0] || "une créatrice";
}

export async function serializeSubmission(s: Row, opts: { photoUrlTtlSeconds?: number } = {}) {
  const name = creditName(s.creator);
  return {
    id: s.id,
    title: s.title,
    status: s.status,
    ageMin: s.ageMin,
    ageMax: s.ageMax,
    durationMinutes: s.durationMinutes,
    materials: s.materials,
    steps: s.steps,
    tips: s.tips,
    safetyNotes: s.safetyNotes,
    contribution: s.contribution,
    exclusive: s.exclusive,
    rateBp: s.rateBp,
    studioBookId: s.studioBookId,
    productId: s.productId,
    previewUrl: s.previewUrl,
    submittedAt: s.submittedAt?.toISOString() ?? null,
    moderatedAt: s.moderatedAt?.toISOString() ?? null,
    creator: { id: s.creator.id, publicName: name, slug: s.creator.slug, bio: s.creator.bio },
    credit: `Une idée de ${name}`,
    photos: await signedPhotoUrls(s.photos, opts.photoUrlTtlSeconds ?? 3600),
  };
}

export const submissionInclude = { creator: { select: { id: true, name: true, publicName: true, slug: true, bio: true } } } as const;
