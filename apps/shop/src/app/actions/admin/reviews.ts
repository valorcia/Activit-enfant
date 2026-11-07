"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { refreshProductRating } from "@/lib/products/service";
import { emitMarketingEvent } from "@/lib/marketing/events";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function moderateReviewAction(reviewId: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<Result> {
  try {
    const user = await assertPermission("reviews:moderate");
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status: decision, moderatedById: user.id, moderatedAt: new Date(), moderationNote: note?.slice(0, 500) || null },
    });
    await refreshProductRating(review.productId);
    revalidateTag("reviews", "max");
    if (decision === "APPROVED") await emitMarketingEvent("review.approved", review.email, { reviewId, productId: review.productId });
    await audit({ userId: user.id, action: `review.${decision.toLowerCase()}`, entity: "review", entityId: reviewId });
    revalidatePath("/admin/avis");
    return { ok: true, message: decision === "APPROVED" ? "Avis publié" : "Avis rejeté" };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function deleteReviewAction(reviewId: string): Promise<Result> {
  try {
    const user = await assertPermission("reviews:moderate");
    const review = await prisma.review.delete({ where: { id: reviewId } });
    await refreshProductRating(review.productId);
    revalidateTag("reviews", "max");
    await audit({ userId: user.id, action: "review.delete", entity: "review", entityId: reviewId });
    revalidatePath("/admin/avis");
    return { ok: true, message: "Avis supprimé" };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
