/**
 * Isolation du studio dans un schéma PostgreSQL dédié.
 *
 * Sur Vercel (ou si DB_SCHEMA est défini), toutes les tables du studio sont créées dans
 * le schéma `studio` au lieu de `public` : une base partagée avec un autre projet
 * n'est jamais touchée, et aucune donnée existante ne peut être écrasée.
 * DB_SCHEMA=public désactive l'isolation.
 */
export function resolveDbSchema(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.DB_SCHEMA?.trim();
  if (explicit) return explicit === "public" ? undefined : explicit;
  return env.VERCEL ? "studio" : undefined;
}

export function withDbSchema(url: string | undefined, schema: string | undefined): string | undefined {
  if (!url || !schema) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("schema")) u.searchParams.set("schema", schema);
    // Pooler Neon (PgBouncer) : désactive les prepared statements côté Prisma
    if (u.hostname.includes("-pooler") && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    return u.toString();
  } catch {
    return url;
  }
}

/** Applique le schéma aux variables lues par Prisma (CLI et client). */
export function applyDbSchemaToEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const schema = resolveDbSchema(env);
  if (!schema) return undefined;
  env.DATABASE_URL = withDbSchema(env.DATABASE_URL, schema);
  env.DATABASE_URL_UNPOOLED = withDbSchema(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL, schema);
  return schema;
}
