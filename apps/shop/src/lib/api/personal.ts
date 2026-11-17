import type { z } from "zod";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { audit } from "@/lib/audit";
import { getForStudio, PersonalItemError } from "@/lib/unwritten/orders";

/**
 * Gabarit des routes de transition des livres personnalisés appelées par le studio
 * (scope personal:write). Journal d'audit sans donnée personnelle (identifiants seulement).
 */
export async function personalTransition<S extends z.ZodType>(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
  schema: S | null,
  action: string,
  run: (id: string, input: z.infer<S>) => Promise<unknown>,
) {
  const auth = await authenticateApiKey(req, "personal:write");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { id } = await ctx.params;
  let input: unknown = {};
  if (schema) {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError(422, "Données invalides", parsed.error.issues);
    input = parsed.data;
  }
  try {
    await run(id, input as z.infer<S>);
  } catch (e) {
    if (e instanceof PersonalItemError) return apiError(e.status, e.message);
    throw e;
  }
  await audit({ actor: `api:${auth.key.prefix}`, action, entity: "personalOrderItem", entityId: id });
  return apiOk(await getForStudio(id));
}
