import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

/** Vide toutes les tables entre les tests (ordre géré par TRUNCATE … CASCADE). */
export async function resetDb() {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await ensureDefaultSite();
}

export const DEFAULT_SITE_ID = "site-default";

/** Univers par défaut (La Malle à Jeux) et son audience, comme après la migration multi-univers. */
export async function ensureDefaultSite() {
  await db.audience.upsert({ where: { id: "aud-familles-enfants" }, create: { id: "aud-familles-enfants", slug: "familles-enfants", name: "Familles & enfants" }, update: {} });
  await db.site.upsert({
    where: { id: DEFAULT_SITE_ID },
    create: { id: DEFAULT_SITE_ID, slug: "la-malle-a-jeux", name: "La Malle à Jeux", audienceId: "aud-familles-enfants", preset: "kit-enfants", status: "ACTIVE", isDefault: true },
    update: {},
  });
}

/** Univers supplémentaire (et son audience) pour les tests multi-univers. */
export async function createSiteFixture(opts: { slug: string; name?: string; domains?: string[]; status?: "ACTIVE" | "TEST" | "ARCHIVED"; preset?: string; audienceSlug?: string }) {
  const audienceSlug = opts.audienceSlug ?? "maison-jardin";
  const audience = await db.audience.upsert({ where: { slug: audienceSlug }, create: { slug: audienceSlug, name: audienceSlug }, update: {} });
  return db.site.create({
    data: { slug: opts.slug, name: opts.name ?? opts.slug, audienceId: audience.id, preset: opts.preset ?? "guide-expert", status: opts.status ?? "ACTIVE", domains: opts.domains ?? [], primaryDomain: opts.domains?.[0] ?? null },
  });
}

export async function createProductFixture(overrides: Partial<{ slug: string; name: string; priceCents: number; status: "DRAFT" | "PUBLISHED"; siteId: string }> = {}, withFiles = 1) {
  const slug = overrides.slug ?? `produit-${Math.random().toString(36).slice(2, 8)}`;
  return db.product.create({
    data: {
      slug,
      ...(overrides.siteId ? { siteId: overrides.siteId } : {}),
      name: overrides.name ?? `Produit ${slug}`,
      priceCents: overrides.priceCents ?? 990,
      status: overrides.status ?? "PUBLISHED",
      publishedAt: new Date(),
      files: { create: Array.from({ length: withFiles }, (_, i) => ({ name: `kit-${i + 1}.pdf`, storageKey: `private/products/${slug}/kit-${i + 1}.pdf`, kind: "MAIN_PDF" as const, sizeBytes: 1000, position: i })) },
    },
    include: { files: true },
  });
}

export async function createPendingOrder(opts: { sessionId: string; email?: string; productIds?: string[]; bundleIds?: string[]; totalCents?: number }) {
  const productIds = opts.productIds ?? [];
  const bundleIds = opts.bundleIds ?? [];
  const total = opts.totalCents ?? 990 * (productIds.length + bundleIds.length);
  return db.order.create({
    data: {
      number: `CC-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      email: opts.email ?? "client@example.com",
      status: "PENDING",
      subtotalCents: total,
      totalCents: total,
      stripeCheckoutSessionId: opts.sessionId,
      items: {
        create: [
          ...productIds.map((productId) => ({ productId, name: "Produit", unitPriceCents: 990, quantity: 1, totalCents: 990 })),
          ...bundleIds.map((bundleId) => ({ bundleId, name: "Pack", unitPriceCents: 1990, quantity: 1, totalCents: 1990 })),
        ],
      },
    },
  });
}

export function paidSession(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    payment_status: "paid" as const,
    payment_intent: `pi_${id}`,
    customer: `cus_${id}`,
    customer_details: { email: "client@example.com", name: "Camille Test", address: null, phone: null, tax_exempt: null, tax_ids: null } as never,
    amount_total: 990,
    currency: "eur",
    total_details: null,
    ...overrides,
  };
}
