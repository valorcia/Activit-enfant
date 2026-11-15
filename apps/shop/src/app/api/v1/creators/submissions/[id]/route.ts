import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { STUDIO_STATUSES, serializeSubmission, submissionInclude } from "@/lib/api/creators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/creators/submissions/:id */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req, "creators:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const row = await prisma.creatorSubmission.findUnique({ where: { id }, include: submissionInclude });
  if (!row || !STUDIO_STATUSES.includes(row.status)) return apiError(404, "Proposition introuvable");
  return apiOk(await serializeSubmission(row));
}
