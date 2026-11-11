import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { filesReadyEmail } from "@/lib/email/templates";
import { emailBrandForSite } from "@/lib/sites/email";
import { orderAccessUrl } from "./access";

/**
 * Commandes payées dont le produit n'avait encore aucun fichier : ce sont les
 * acheteurs à prévenir quand le premier fichier est ajouté.
 */
export async function buyersAwaitingFiles(productId: string, client: PrismaClient = prisma) {
  const rows = await client.downloadEntitlement.findMany({
    where: { productId, revokedAt: null, order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, email: { not: "" } } },
    select: { order: { select: { id: true, number: true, email: true, siteId: true } } },
  });
  const seen = new Set<string>();
  return rows.map((r) => r.order).filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

/**
 * À appeler juste après l'ajout d'un fichier, avec le nombre de fichiers que le
 * produit avait AVANT l'opération (remplacement compris). Si le produit n'en
 * avait aucun, chaque acheteur reçoit un email avec son lien de téléchargement ;
 * un simple remplacement de PDF ne renvoie donc rien.
 * Ne lève jamais d'erreur : l'ajout du fichier reste valide même si l'envoi échoue.
 */
export async function notifyBuyersIfFirstFile(productId: string, filesBefore: number): Promise<number> {
  if (filesBefore > 0) return 0;
  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
    if (!product) return 0;
    const orders = await buyersAwaitingFiles(productId);
    let sent = 0;
    for (const o of orders) {
      try {
        const brand = await emailBrandForSite(o.siteId);
        const accessUrl = orderAccessUrl(o.id, undefined, brand.appUrl);
        await sendEmail({ to: o.email, ...filesReadyEmail(brand, { orderNumber: o.number, productName: product.name, accessUrl }) });
        sent++;
      } catch (e) {
        console.error("[files-ready] envoi impossible pour la commande", o.number, e instanceof Error ? e.message : e);
      }
    }
    return sent;
  } catch (e) {
    console.error("[files-ready] notification impossible :", e instanceof Error ? e.message : e);
    return 0;
  }
}
