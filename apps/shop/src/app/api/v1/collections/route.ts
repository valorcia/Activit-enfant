import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "products:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const rows = await prisma.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, slug: true, name: true, description: true, color: true, isVisible: true } });
  return apiOk(rows);
}
