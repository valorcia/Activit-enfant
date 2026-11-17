import { z } from "zod";
import { personalTransition } from "@/lib/api/personal";
import { startProduction } from "@/lib/unwritten/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/personal/items/:id/production { studioRef? } — PENDING_GENERATION | ERROR → IN_PRODUCTION (idempotent). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return personalTransition(req, ctx, z.object({ studioRef: z.string().min(1).max(64).optional() }), "personal.production", (id, input) => startProduction(id, input.studioRef ?? null));
}
