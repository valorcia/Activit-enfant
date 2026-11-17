import { z } from "zod";
import { personalTransition } from "@/lib/api/personal";
import { privateObjectSize, MAX_PRESIGNED_FILE } from "@/lib/api/file-presign";
import { attachPersonalFile, PersonalItemError, personalFilePrefix } from "@/lib/unwritten/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/v1/personal/items/:id/file/register { key, name } — enregistre le PDF déposé par URL signée (taille lue dans S3). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return personalTransition(req, ctx, z.object({ key: z.string().min(1).max(400), name: z.string().min(1).max(160) }), "personal.file", async (id, input) => {
    if (!input.key.startsWith(personalFilePrefix(id))) throw new PersonalItemError("Clé de fichier invalide pour ce livre", 422);
    const size = await privateObjectSize(input.key).catch(() => 0);
    if (!size) throw new PersonalItemError("Fichier introuvable dans le stockage (téléversement non terminé ?)", 422);
    if (size > MAX_PRESIGNED_FILE) throw new PersonalItemError("Fichier trop volumineux (500 Mo max)", 422);
    await attachPersonalFile(id, { key: input.key, name: input.name, mime: "application/pdf", size });
  });
}
