import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const PAGES_TAG = "pages";

/** Page éditoriale publiée (CGV, confidentialité, FAQ…), mise en cache. */
export const getPublishedPage = (siteId: string, slug: string) =>
  unstable_cache(async () => prisma.staticPage.findFirst({ where: { siteId, slug, status: "PUBLISHED" } }), ["static-page", siteId, slug], { tags: [PAGES_TAG], revalidate: 600 })();
