/**
 * DÉVELOPPEMENT — publie (ou re-synchronise) un livre vers la boutique depuis le terminal.
 * Usage : pnpm tsx scripts/dev-publish-to-shop.ts <bookId> [--draft] [--no-previews]
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { publishBookToShop } from "../src/lib/shop/publish";
import { closeBrowser } from "../src/lib/pdf/browser";

async function main() {
  const [bookId, ...flags] = process.argv.slice(2);
  if (!bookId) throw new Error("Indiquez l'identifiant du livre");
  const r = await publishBookToShop(bookId, { publish: !flags.includes("--draft"), withPreviews: !flags.includes("--no-previews"), log: (m) => console.log(`· ${m}`) });
  console.log(`Statut : ${r.status}`);
  console.log(`Produit : ${r.product.slug} (${r.product.status}) — ${r.product.publicUrl ?? r.product.editUrl}`);
  for (const w of r.warnings) console.warn(`⚠ ${w}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await closeBrowser().catch(() => undefined); await prisma.$disconnect(); });
