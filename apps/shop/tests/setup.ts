import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Prépare la base de test PostgreSQL : applique les migrations (non destructif),
 * puis chaque fichier de test vide les tables entre les cas (tests/helpers/db.ts).
 * DATABASE_URL est fixé par vitest.config.ts (shop_test), jamais la base de dev.
 */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/shop_test";
  if (!/shop_test|_test\b/.test(url)) throw new Error(`Refus : la base de test doit s'appeler *_test (${url})`);
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
    stdio: "pipe",
  });
}
