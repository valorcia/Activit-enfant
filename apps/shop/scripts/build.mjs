/**
 * Build unifié (local, CI, Vercel) :
 *  1. prisma generate
 *  2. si DATABASE_URL est défini : prisma migrate deploy puis seed idempotent
 *  3. next build
 * Évite l'oubli d'une commande de build personnalisée côté hébergeur.
 */
import { spawnSync } from "node:child_process";
import "dotenv/config"; // charge .env en local (sans effet sur Vercel où les variables sont déjà définies)

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run("npx", ["prisma", "generate"]);

if (process.env.DATABASE_URL) {
  if (!process.env.DATABASE_URL_UNPOOLED) {
    console.log("ℹ DATABASE_URL_UNPOOLED absent : utilisation de DATABASE_URL pour les migrations.");
    process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
  }
  run("npx", ["prisma", "migrate", "deploy"]);
  if (process.env.SKIP_SEED !== "1") run("npx", ["tsx", "prisma/seed.ts"]);
} else {
  console.warn("⚠ DATABASE_URL non défini : migrations et seed ignorés (le build échouera si des pages lisent la base).");
}

run("npx", ["next", "build"]);
