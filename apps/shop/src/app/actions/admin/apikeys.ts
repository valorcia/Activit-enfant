"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertPermission } from "@/lib/auth/session";
import { randomToken, sha256 } from "@/lib/tokens";
import { API_SCOPES } from "@/lib/api/auth";

const schema = z.object({ name: z.string().min(2).max(80), scopes: z.array(z.enum(API_SCOPES)).min(1) });

export type CreateKeyResult = { ok: true; id: string; secret: string; prefix: string } | { ok: false; error: string };

/** Crée une clé API. La clé en clair n'est renvoyée qu'une seule fois ; seul son hash est stocké. */
export async function createApiKeyAction(raw: unknown): Promise<CreateKeyResult> {
  try {
    const user = await assertPermission("apikeys:write");
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Nom et au moins un scope requis" };
    const secret = `cc_${randomToken(32)}`;
    const prefix = secret.slice(0, 8);
    const key = await prisma.apiKey.create({ data: { name: parsed.data.name, prefix, keyHash: sha256(secret), scopes: parsed.data.scopes, createdById: user.id } });
    await audit({ userId: user.id, action: "apikey.create", entity: "apiKey", entityId: key.id, data: { prefix, scopes: parsed.data.scopes } });
    revalidatePath("/admin/api");
    return { ok: true, id: key.id, secret, prefix };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}

export async function revokeApiKeyAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertPermission("apikeys:write");
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    await audit({ userId: user.id, action: "apikey.revoke", entity: "apiKey", entityId: id });
    revalidatePath("/admin/api");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur" }; }
}
