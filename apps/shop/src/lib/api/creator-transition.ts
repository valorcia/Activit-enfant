import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { serializeSubmission, submissionInclude } from "@/lib/api/creators";
import { audit } from "@/lib/audit";

/** Gabarit commun des routes de transition appelées par le studio (scope creators:write). */
export async function creatorTransition<S extends z.ZodType>(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
  schema: S,
  action: string,
  run: (id: string, input: z.infer<S>) => Promise<unknown>,
) {
  const auth = await authenticateApiKey(req, "creators:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError(422, "Données invalides", parsed.error.issues);
  const exists = await prisma.creatorSubmission.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return apiError(404, "Proposition introuvable");
  try {
    await run(id, parsed.data);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 409 || status === 404) return apiError(status, (e as Error).message);
    throw e;
  }
  await audit({ actor: `api:${auth.key.prefix}`, action, entity: "creatorSubmission", entityId: id });
  const row = await prisma.creatorSubmission.findUniqueOrThrow({ where: { id }, include: submissionInclude });
  return apiOk(await serializeSubmission(row));
}
