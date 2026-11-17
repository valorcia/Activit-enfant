import { personalTransition } from "@/lib/api/personal";
import { deliverPersonalItem } from "@/lib/unwritten/orders";
import { sendBookReady } from "@/lib/unwritten/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/personal/items/:id/deliver — PDF déposé → DELIVERED : droit de téléchargement individuel
 * et e-mail localisé à l'acheteur (et au destinataire d'un cadeau qu'il a rempli). Idempotent : un second
 * appel ne crée ni droit ni e-mail.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return personalTransition(req, ctx, null, "personal.deliver", async (id) => {
    const res = await deliverPersonalItem(id);
    if (res.firstDelivery) {
      await sendBookReady(id).catch((e) => console.error(`[unwritten] e-mail de livraison non envoyé pour le livre ${id}`, e instanceof Error ? e.message : e));
    }
  });
}
