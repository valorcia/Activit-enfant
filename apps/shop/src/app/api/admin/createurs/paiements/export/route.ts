import { getAdminUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { payoutsCsv, periodOf } from "@/lib/creators/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export CSV des paiements d'une période, avec IBAN déchiffré (administrateurs uniquement, accès journalisé). */
export async function GET(req: Request) {
  const user = await getAdminUser();
  if (!user) return new Response("Authentification requise", { status: 401 });
  if (!roleCan(user.role, "creators:payouts")) return new Response("Permission insuffisante", { status: 403 });
  const raw = new URL(req.url).searchParams.get("periode") ?? periodOf(new Date());
  if (!/^\d{4}-\d{2}$/.test(raw)) return new Response("Période invalide (AAAA-MM)", { status: 400 });
  const { csv, count } = await payoutsCsv(raw);
  await audit({ userId: user.id, actor: user.email, action: "creators.payouts.export", entity: "creatorPayout", entityId: raw, data: { count } });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paiements-createurs-${raw}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
