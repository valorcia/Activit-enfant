import { z } from "zod";
import { creatorTransition } from "@/lib/api/creator-transition";
import { startProduction } from "@/lib/creators/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/creators/submissions/:id/production { bookId } — ACCEPTED → IN_PRODUCTION */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return creatorTransition(req, ctx, z.object({ bookId: z.string().min(1).max(64) }), "creator.submission.production", (id, input) => startProduction(id, input.bookId));
}
