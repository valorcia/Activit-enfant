import { z } from "zod";
import { personalTransition } from "@/lib/api/personal";
import { reportProductionError } from "@/lib/unwritten/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/personal/items/:id/error { message } — signale une erreur (message technique, sans donnée personnelle). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return personalTransition(req, ctx, z.object({ message: z.string().min(1).max(500) }), "personal.error", (id, input) => reportProductionError(id, input.message));
}
