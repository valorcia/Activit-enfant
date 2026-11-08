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

// Copie de src/lib/db-url.ts (ce script tourne avant toute compilation TypeScript)
function resolveDbSchema(env) {
  const explicit = env.DB_SCHEMA?.trim();
  if (explicit) return explicit === "public" ? undefined : explicit;
  return env.VERCEL ? "studio" : undefined;
}
function withDbSchema(url, schema) {
  if (!url || !schema) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("schema")) u.searchParams.set("schema", schema);
    if (u.hostname.includes("-pooler") && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    return u.toString();
  } catch { return url; }
}
function applyDbSchemaToEnv(env) {
  const schema = resolveDbSchema(env);
  if (!schema) return undefined;
  env.DATABASE_URL = withDbSchema(env.DATABASE_URL, schema);
  env.DATABASE_URL_UNPOOLED = withDbSchema(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL, schema);
  return schema;
}

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
  // Schéma PostgreSQL dédié (« shop » sur Vercel, ou DB_SCHEMA) : n'écrase jamais les tables d'un autre projet
  const schema = applyDbSchemaToEnv(process.env);
  if (schema) console.log(`ℹ Tables du studio dans le schéma PostgreSQL « ${schema} ».`);
  migrate();
  if (process.env.SEED_DEMO === "1") run("npx", ["tsx", "prisma/seed.ts"]); // le seed du studio crée un livre de démonstration : sur demande seulement
} else {
  console.warn("⚠ DATABASE_URL non défini : migrations et seed ignorés (le build échouera si des pages lisent la base).");
}

if (process.env.SKIP_NEXT_BUILD !== "1") run("npx", ["next", "build"]);
