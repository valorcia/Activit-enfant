import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { listApiSites } from "@/lib/api/sites";

export const dynamic = "force-dynamic";

/** Liste des univers (sites) : toute clé API valide suffit (lecture seule, aucune donnée sensible). */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiError(auth.status, auth.error);
  return apiOk(await listApiSites(prisma, env.appUrl));
}
