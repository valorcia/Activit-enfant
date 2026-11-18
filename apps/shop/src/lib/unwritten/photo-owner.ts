import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getDraft, draftAnswers, draftDefinition, resolveDraftState } from "./drafts";
import { combinedGiftAnswers, findGiftByToken, giftAnswers, itemAnswers, itemDefinition } from "./orders";
import { audienceForMode, photoIdsIn, visibleQuestions, type Answers, type Audience } from "./questionnaire/engine";
import type { QuestionnaireDefinition } from "./questionnaire/schema";
import { cookieDraftIds } from "./session";

/**
 * « Propriétaire » des photos d'une requête : le brouillon de ce navigateur (cookie signé) ou
 * le lien cadeau (jeton). Seules les photos citées dans SES réponses lui sont accessibles.
 */
export interface PhotoOwner {
  kind: "draft" | "gift";
  id: string;
  editable: boolean;
  definition: QuestionnaireDefinition;
  audience: Audience;
  /** Réponses modifiables par ce répondant (où ajouter les photos). */
  own: Answers;
  /** Toutes les réponses visibles par ce répondant (contrôle d'accès en lecture). */
  readable: Answers;
  save(answers: Answers): Promise<void>;
}

export async function ownerFromDraft(productSlug: string, siteId: string): Promise<PhotoOwner | null> {
  const product = await prisma.product.findFirst({ where: { siteId, slug: productSlug }, select: { id: true } });
  if (!product) return null;
  const ids = await cookieDraftIds();
  for (const id of [...ids].reverse()) {
    const draft = await getDraft(id);
    if (!draft || draft.productId !== product.id || draft.siteId !== siteId) continue;
    const state = await resolveDraftState(draft);
    if (state === "expired") continue;
    const answers = draftAnswers(draft);
    return {
      kind: "draft",
      id: draft.id,
      editable: state === "editable",
      definition: draftDefinition(draft),
      audience: audienceForMode(draft.mode),
      own: answers,
      readable: answers,
      save: async (next) => {
        await prisma.personalizationDraft.update({ where: { id: draft.id }, data: { answers: next as Prisma.InputJsonValue } });
      },
    };
  }
  return null;
}

export async function ownerFromGift(token: string): Promise<PhotoOwner | null> {
  const found = await findGiftByToken(token);
  if (!found.ok) return null;
  const claim = found.claim;
  const def = itemDefinition(claim.personalItem);
  if (!def) return null;
  const buyer = itemAnswers(claim.personalItem);
  return {
    kind: "gift",
    id: claim.id,
    editable: true,
    definition: def,
    audience: "subject",
    own: giftAnswers(claim),
    readable: combinedGiftAnswers(claim),
    save: async (next) => {
      const own = Object.fromEntries(Object.entries(next).filter(([k]) => !(k in buyer)));
      await prisma.giftClaim.update({ where: { id: claim.id }, data: { answers: own as Prisma.InputJsonValue } });
    },
  };
}

/** Une photo est lisible par ce propriétaire si elle figure dans ses réponses. */
export function ownerCanRead(owner: PhotoOwner, photoId: string): boolean {
  return photoIdsIn(owner.readable).includes(photoId);
}

/** Question « photos » visible pour ce répondant, compte tenu de ses réponses actuelles. */
export function visiblePhotoQuestion(owner: PhotoOwner, questionId: string) {
  return visibleQuestions(owner.definition, owner.readable, owner.audience).find((q) => q.id === questionId && q.type === "photos") ?? null;
}
