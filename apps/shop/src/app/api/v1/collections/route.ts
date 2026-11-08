import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const siteSlug = new URL(req.url).searchParams.get("site");
  const rows = await prisma.collection.findMany({
    where: siteSlug ? { site: { slug: siteSlug } } : {},
    orderBy: [{ siteId: "asc" }, { position: "asc" }],
    select: { id: true, slug: true, name: true, description: true, color: true, isVisible: true, site: { select: { slug: true } } },
  });
  return apiOk(rows);
}
