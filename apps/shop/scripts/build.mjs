/**
 * Build unifié (local, CI, Vercel) :
 *  1. prisma generate
 *  2. si DATABASE_URL est défini : prisma migrate deploy puis seed idempotent
 *  3. next build
 * Évite l'oubli d'une commande de build personnalisée côté hébergeur.
 */
import { spawnSync } from "node:child_process";
import "dotenv/config"; // charge .env en local (sans effet sur Vercel où les variables sont déjà définies)

import { readdirSync } from "node:fs";

function run(cmd, args, { allowFailure = false } = {}) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: allowFailure ? ["inherit", "pipe", "pipe"] : "inherit", shell: process.platform === "win32" });
  if (allowFailure) {
    const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
    process.stdout.write(out);
    return { ok: res.status === 0, out };
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
  return { ok: true, out: "" };
}

/**
 * Applique les migrations. Si la base n'est pas vide mais n'a pas d'historique
 * Prisma (P3005 : base créée avant les migrations, ou tables tierces), on
 * synchronise le schéma avec `db push` puis on marque les migrations comme
 * appliquées (baseline), afin que les prochains déploiements soient incrémentaux.
 */
function migrate() {
  const res = run("npx", ["prisma", "migrate", "deploy"], { allowFailure: true });
  if (res.ok) return;
  if (!res.out.includes("P3005")) process.exit(1);
  console.warn("\n⚠ Base non vide sans historique de migrations (P3005) : synchronisation du schéma puis baseline.");
  run("npx", ["prisma", "db", "push", "--skip-generate"]);
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const m of migrations) run("npx", ["prisma", "migrate", "resolve", "--applied", m]);
}

run("npx", ["prisma", "generate"]);

if (process.env.DATABASE_URL) {
  if (!process.env.DATABASE_URL_UNPOOLED) {
    console.log("ℹ DATABASE_URL_UNPOOLED absent : utilisation de DATABASE_URL pour les migrations.");
    process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
  }
  migrate();
  if (process.env.SKIP_SEED !== "1") run("npx", ["tsx", "prisma/seed.ts"]);
} else {
  console.warn("⚠ DATABASE_URL non défini : migrations et seed ignorés (le build échouera si des pages lisent la base).");
}

if (process.env.SKIP_NEXT_BUILD !== "1") run("npx", ["next", "build"]);
