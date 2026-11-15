import { z } from "zod";
import { creatorTransition } from "@/lib/api/creator-transition";
import { markPreviewReady } from "@/lib/creators/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ previewUrl: z.url({ protocol: /^https?$/ }).max(2000) });

/** POST /api/v1/creators/submissions/:id/preview { previewUrl } — → PREVIEW_READY, e-mail à la créatrice */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return creatorTransition(req, ctx, schema, "creator.submission.preview", (id, input) => markPreviewReady(id, input.previewUrl));
}
