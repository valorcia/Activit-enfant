"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/queue/jobs";
import { QUEUES } from "@/lib/queue/boss";
import { getShopSettings, saveShopSettings, maskShopSettings } from "@/lib/settings";
import { ShopListingSchema } from "@/lib/schemas/settings";
import { testShopConnection } from "@/lib/shop/publish";
import { ShopApiError } from "@/lib/shop/client";

export async function saveShopSettingsAction(input: unknown) {
  await saveShopSettings(input);
  revalidatePath("/settings");
  return maskShopSettings(await getShopSettings());
}

export async function testShopConnectionAction(): Promise<{ ok: true; categories: number; collections: number } | { ok: false; error: string }> {
  try {
    const r = await testShopConnection();
    return { ok: true, categories: r.categories.length, collections: r.collections.length };
  } catch (e) {
    return { ok: false, error: e instanceof ShopApiError && e.status === 401 ? "Clé API refusée (401)" : e instanceof Error ? e.message : "Connexion impossible" };
  }
}

/** Catégories et collections de la boutique (pour le formulaire de fiche). */
export async function shopTaxonomyAction(): Promise<{ categories: Array<{ slug: string; name: string }>; collections: Array<{ slug: string; name: string }> } | null> {
  try {
    const r = await testShopConnection();
    return { categories: r.categories.map((c) => ({ slug: c.slug, name: c.name })), collections: r.collections.map((c) => ({ slug: c.slug, name: c.name })) };
  } catch {
    return null;
  }
}

export async function saveShopListingAction(bookId: string, input: unknown) {
  const listing = ShopListingSchema.parse(input);
  await prisma.book.update({ where: { id: bookId }, data: { shopListing: listing } });
  revalidatePath(`/books/${bookId}`);
}

/** Lance (en tâche de fond) la publication ou la re-synchronisation du livre vers la boutique. */
export async function publishToShopAction(bookId: string, opts: { publish: boolean }) {
  const settings = await getShopSettings();
  if (!settings.shopApiUrl || !settings.shopApiKey) throw new Error("Boutique non configurée : renseignez l'URL et la clé API dans Paramètres.");
  const job = await enqueue(QUEUES.shopPublish, { bookId, publish: opts.publish });
  revalidatePath(`/books/${bookId}`);
  return { jobId: job.id };
}
