"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAutopilotSettings, getShopSettings } from "@/lib/settings";
import { ShopClient } from "@/lib/shop/client";
import { initStages } from "@/lib/autopilot/stages";
import { startRun } from "@/lib/autopilot/runner";
import { briefFromSubmission, CREATOR_KIT_TYPES } from "@/lib/creators/brief";
import { activeSites } from "@/lib/universes";
import { siteBySlug } from "@/lib/universes/sites";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * « Créer l'e-book » depuis une idée de créatrice acceptée : brief composé depuis la
 * proposition (plan importé tel quel, crédit « Une idée de … »), pilote automatique lancé,
 * proposition mémorisée sur le run puis sur le livre (customization.creator).
 */
export async function createEbookFromSubmissionAction(submissionId: string, opts: { kitType?: string; count?: number; priceCents?: number; siteSlug?: string | null } = {}): Promise<Result<{ runId: string }>> {
  try {
    const shop = await getShopSettings();
    const client = new ShopClient({ baseUrl: shop.shopApiUrl, apiKey: shop.shopApiKey });
    const sub = await client.creatorSubmission(submissionId);
    if (!sub) return { ok: false, error: "Proposition introuvable dans la boutique" };
    if (sub.status !== "ACCEPTED" && sub.status !== "IN_PRODUCTION") return { ok: false, error: "Cette idée est déjà fabriquée (aperçu envoyé ou en vente)." };
    const existing = await prisma.autopilotRun.findFirst({ where: { status: { in: ["RUNNING", "WAITING_APPROVAL", "WAITING_INPUT"] }, state: { path: ["creator", "submissionId"], equals: submissionId } }, select: { id: true } });
    if (existing) return { ok: true, data: { runId: existing.id } };
    const kitType = CREATOR_KIT_TYPES.some((k) => k.key === opts.kitType) ? opts.kitType : undefined;
    const site = siteBySlug(await activeSites(), opts.siteSlug);
    const brief = briefFromSubmission(sub, { kitType, count: opts.count, priceCents: opts.priceCents, siteSlug: site?.slug ?? null });
    const cfg = await getAutopilotSettings();
    const runId = await startRun({ brief, config: cfg, title: sub.title, stages: initStages(cfg), siteSlug: site?.slug ?? null, creator: { submissionId: sub.id, name: sub.creator.publicName, credit: sub.credit } });
    revalidatePath("/autopilot");
    revalidatePath("/createurs");
    return { ok: true, data: { runId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
