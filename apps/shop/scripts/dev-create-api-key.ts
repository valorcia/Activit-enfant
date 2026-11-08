/**
 * DÉVELOPPEMENT — crée une clé API (affichée une seule fois) pour tester l'API v1
 * ou relier le studio en local. En production, créez les clés depuis l'admin.
 *
 * Usage : pnpm tsx scripts/dev-create-api-key.ts "Nom de la clé" [scopes séparés par des virgules]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

if (process.env.NODE_ENV === "production") {
  console.error("Refusé en production : créez la clé depuis Administration → API & automatisation.");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  const name = process.argv[2] ?? "Clé de développement";
  const scopes = (process.argv[3] ?? "products:read,products:write,products:publish").split(",").map((s) => s.trim()).filter(Boolean);
  const key = "cc_" + randomBytes(24).toString("base64url");
  await prisma.apiKey.create({ data: { name, prefix: key.slice(0, 8), keyHash: createHash("sha256").update(key).digest("hex"), scopes } });
  console.log(key);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
