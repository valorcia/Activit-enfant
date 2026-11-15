import { prisma } from "@/lib/db";
import { apiError, apiOk, authenticateApiKey } from "@/lib/api/auth";
import { STUDIO_STATUSES, serializeSubmission, submissionInclude } from "@/lib/api/creators";
import type { CreatorSubmissionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/creators/submissions?status=ACCEPTED[,IN_PRODUCTION…] — idées acceptées, avec URLs signées des photos (1 h). */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req, "creators:read");
  if (!auth.ok) return apiError(auth.status, auth.error);
  const raw = new URL(req.url).searchParams.get("status") ?? "ACCEPTED";
  const statuses = raw === "all" ? STUDIO_STATUSES : raw.split(",").map((s) => s.trim().toUpperCase());
  if (statuses.some((s) => !STUDIO_STATUSES.includes(s as CreatorSubmissionStatus))) return apiError(422, `Statut invalide : ${STUDIO_STATUSES.join(", ")} ou all`);
  const rows = await prisma.creatorSubmission.findMany({
    where: { status: { in: statuses as CreatorSubmissionStatus[] } },
    orderBy: [{ moderatedAt: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: submissionInclude,
  });
  return apiOk(await Promise.all(rows.map((r) => serializeSubmission(r))), 200, { total: rows.length });
}
