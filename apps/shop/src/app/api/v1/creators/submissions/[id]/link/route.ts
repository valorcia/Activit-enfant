import { z } from "zod";
import { creatorTransition } from "@/lib/api/creator-transition";
import { linkSubmissionToProduct } from "@/lib/creators/service";
import { revalidateCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/creators/submissions/:id/link { productId } — crédite la créatrice sur le produit (taux de redevance compris) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return creatorTransition(req, ctx, z.object({ productId: z.string().min(1).max(64) }), "creator.submission.link", async (id, input) => {
    await linkSubmissionToProduct(id, input.productId);
    const p = await prisma.product.findUnique({ where: { id: input.productId }, select: { slug: true } });
    if (p) revalidateCatalog([p.slug]);
  });
}
