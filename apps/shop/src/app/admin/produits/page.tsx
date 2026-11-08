import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import type { Prisma, ProductStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { DataTable, AdminPagination } from "@/components/admin/data-table";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { PublishScheduledButton } from "@/components/admin/publish-scheduled-button";
import { formatDate, formatPrice } from "@/lib/utils";
import { adminSiteWhere } from "@/lib/sites";

export const metadata = { title: "Produits" };
export const dynamic = "force-dynamic";

const STATUSES: ProductStatus[] = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("products:read");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = STATUSES.includes(sp.statut as ProductStatus) ? (sp.statut as ProductStatus) : undefined;
  const categoryId = sp.categorie || undefined;
  const sort = sp.tri ?? "recent";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 25;
  const needsReview = sp.validation === "1";

  const siteWhere = await adminSiteWhere();
  const where: Prisma.ProductWhereInput = {
    ...siteWhere,
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }, { universe: { contains: q, mode: "insensitive" } }] } : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(needsReview ? { needsReview: true } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput = sort === "nom" ? { name: "asc" } : sort === "ventes" ? { salesCount: "desc" } : sort === "prix" ? { priceCents: "asc" } : { updatedAt: "desc" };

  const [products, total, categories, counts] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage, include: { category: { select: { name: true } }, images: { where: { role: "MAIN" }, take: 1 }, _count: { select: { files: true } } } }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: siteWhere, orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.product.groupBy({ by: ["status"], where: siteWhere, _count: true }),
  ]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const reviewCount = await prisma.product.count({ where: { ...siteWhere, needsReview: true } });
  const dueCount = await prisma.product.count({ where: { ...siteWhere, status: "SCHEDULED", scheduledAt: { lte: new Date() } } });
  const buildHref = (p: number) => { const u = new URLSearchParams({ ...(q && { q }), ...(status && { statut: status }), ...(categoryId && { categorie: categoryId }), tri: sort, page: String(p) }); return `/admin/produits?${u}`; };

  return (
    <div>
      <AdminPageHeader title="Produits" description={`${total} produit${total > 1 ? "s" : ""} · ${counts.map((c) => `${c._count} ${({ DRAFT: "brouillon(s)", SCHEDULED: "programmé(s)", PUBLISHED: "publié(s)", ARCHIVED: "archivé(s)" })[c.status]}`).join(" · ")}`}
        actions={<><PublishScheduledButton dueCount={dueCount} /><Button asChild variant="outline" size="sm"><Link href="/admin/import">Importer un CSV</Link></Button><Button asChild variant="admin" size="sm"><Link href="/admin/produits/nouveau"><Plus className="size-4" /> Nouveau produit</Link></Button></>} />

      {reviewCount > 0 && !needsReview && (
        <Link href="/admin/produits?validation=1" className="mb-4 flex items-center gap-2 rounded-xl border border-honey bg-honey-light px-4 py-2 text-sm font-semibold text-honey-dark"><AlertTriangle className="size-4" /> {reviewCount} produit{reviewCount > 1 ? "s" : ""} créé{reviewCount > 1 ? "s" : ""} via l&apos;API en attente de validation humaine</Link>
      )}

      <form className="mb-4 grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_160px_180px_150px_auto]" method="get">
        <Input name="q" defaultValue={q} placeholder="Rechercher (nom, slug, univers)…" aria-label="Recherche" className="h-10" />
        <NativeSelect name="statut" defaultValue={status ?? ""} aria-label="Statut" className="h-10"><option value="">Tous les statuts</option>{STATUSES.map((s) => <option key={s} value={s}>{({ DRAFT: "Brouillon", SCHEDULED: "Programmé", PUBLISHED: "Publié", ARCHIVED: "Archivé" })[s]}</option>)}</NativeSelect>
        <NativeSelect name="categorie" defaultValue={categoryId ?? ""} aria-label="Catégorie" className="h-10"><option value="">Toutes les catégories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
        <NativeSelect name="tri" defaultValue={sort} aria-label="Tri" className="h-10"><option value="recent">Modifiés récemment</option><option value="nom">Nom A→Z</option><option value="ventes">Meilleures ventes</option><option value="prix">Prix croissant</option></NativeSelect>
        <Button type="submit" variant="soft" size="sm" className="h-10">Filtrer</Button>
      </form>

      <DataTable
        rows={products}
        rowKey={(p) => p.id}
        empty="Aucun produit ne correspond. Créez votre premier produit ou importez un CSV."
        columns={[
          { key: "product", header: "Produit", render: (p) => (
            <div className="flex items-center gap-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-cream-dark/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.images[0] ? <img src={p.images[0].url} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[10px] text-ink-muted">—</span>}
              </div>
              <div className="min-w-0">
                <Link href={`/admin/produits/${p.id}`} className="block truncate font-bold hover:underline">{p.name}</Link>
                <p className="truncate text-xs text-ink-muted">{p.category?.name ?? "Sans catégorie"}{p.universe ? ` · ${p.universe}` : ""} · {p._count.files} fichier{p._count.files > 1 ? "s" : ""}{p.needsReview ? " · À valider" : ""}</p>
              </div>
            </div>
          ) },
          { key: "status", header: "Statut", render: (p) => <div><StatusPill status={p.status} />{p.status === "SCHEDULED" && p.scheduledAt && <p className="text-xs text-ink-muted">{formatDate(p.scheduledAt, { timeStyle: "short" })}</p>}</div> },
          { key: "price", header: "Prix", render: (p) => <span className="font-semibold">{formatPrice(p.priceCents, p.currency)}{p.salePriceCents != null && <span className="ml-1 text-xs text-coral-dark">promo {formatPrice(p.salePriceCents, p.currency)}</span>}</span> },
          { key: "sales", header: "Ventes", render: (p) => <span>{p.salesCount}</span> },
          { key: "updated", header: "Modifié", render: (p) => <span className="text-ink-muted">{formatDate(p.updatedAt)}</span> },
          { key: "actions", header: "", className: "text-right", render: (p) => <ProductRowActions id={p.id} slug={p.slug} status={p.status} /> },
        ]}
      />
      <AdminPagination page={page} pages={pages} buildHref={buildHref} />
    </div>
  );
}
