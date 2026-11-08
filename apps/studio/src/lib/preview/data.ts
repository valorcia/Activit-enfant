import { prisma } from "../db";
import { buildContextForBook } from "../layout/book";
import { PageLayoutSchema, type PageLayout, type BookTheme } from "../schemas/layout";
import { numberPages } from "../layout/pageNumbers";
import { checkLayoutImages, type ImageIssue, type ImageInfo } from "../quality/images";
import { kitLabel } from "../kits/types";
import { BOOK_TYPES } from "../schemas/activity";
import { loadSites } from "../universes";
import { siteBySlug } from "../universes/sites";
import { currentBookIllustrations, sketchSummary } from "../generation/rework";
import { formatUsd } from "../utils";

/** Données de l'aperçu d'un livre (studio et lien partagé) : pages réelles = rendu du PDF. */
export interface PreviewIllustration {
  id: string;
  label: string;
  src: string;
  width: number | null;
  height: number | null;
  focalX: number;
  focalY: number;
  zoom: number;
  fit: "cover" | "contain" | null;
  isSketch: boolean;
  isDemo: boolean;
  status: string;
  targetRatio: string | null;
  autoFocalX: number | null;
  autoFocalY: number | null;
}

export interface BookPreviewData {
  book: { id: string; title: string; universe: string | null; typeLabel: string; status: string; pageCount: number; costLabel: string; costUsd: number; imageState: "sketch" | "final" | "mixed" | "none"; shopPublishedAt: string | null; shopPublicUrl: string | null };
  widthMm: number;
  heightMm: number;
  theme: BookTheme;
  marginMm: number;
  pages: { id: string; templateKey: string; layout: PageLayout; number?: number }[];
  illustrations: Record<string, PreviewIllustration>;
  issues: ImageIssue[];
  sketches: { count: number; ids: string[]; sketchCostUsd: number; finalCostUsd: number; quality: string };
  latestPdf: { exportId: string; assetId: string; createdAt: string; pageCount: number | null } | null;
  activeExport: { exportId: string; status: string } | null;
}

function slotLabel(i: { kind: string; slot: string | null; stepIndex: number | null }) {
  if (i.kind === "COVER") return "Couverture";
  if (i.kind === "FINAL") return "Résultat final";
  if (i.kind === "STEP") return `Étape ${(i.stepIndex ?? 0) + 1}`;
  return (i.slot ?? "Illustration").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** `assetParam` : ajoute ?pt=<jeton> aux images (lien partagé sans session). */
export async function loadBookPreview(bookId: string, opts: { assetParam?: string } = {}): Promise<BookPreviewData | null> {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return null;
  const ctx = await buildContextForBook(bookId);
  const rows = await prisma.bookPage.findMany({ where: { bookId }, orderBy: { position: "asc" } });
  const withAsset = (src: string | undefined) => (src && opts.assetParam && src.startsWith("/api/assets/") ? `${src}${src.includes("?") ? "&" : "?"}pt=${encodeURIComponent(opts.assetParam)}` : src);
  const pages = rows.flatMap((r) => {
    const l = PageLayoutSchema.safeParse(r.layout);
    if (!l.success) return [];
    const layout: PageLayout = opts.assetParam
      ? { ...l.data, blocks: l.data.blocks.map((b) => (b.type === "image" ? { ...b, src: withAsset(b.src) } : b.type === "step" ? { ...b, imageSrc: withAsset(b.imageSrc) } : b)) }
      : l.data;
    return [{ id: r.id, templateKey: r.templateKey, layout }];
  });
  const numbers = numberPages(pages);
  const ills = await currentBookIllustrations(bookId);
  // Les pages peuvent référencer une version non courante (pages verrouillées) : on les ajoute
  const referenced = new Set<string>();
  for (const p of pages) for (const b of p.layout.blocks) if (b.type === "image" && b.illustrationId) referenced.add(b.illustrationId);
  const missing = [...referenced].filter((id) => !ills.some((i) => i.id === id));
  const extra = missing.length ? await prisma.illustration.findMany({ where: { id: { in: missing } }, include: { asset: true } }) : [];
  const all = [...ills, ...extra].filter((i) => i.assetId);
  const illustrations: Record<string, PreviewIllustration> = {};
  const info = new Map<string, ImageInfo>();
  for (const i of all) {
    illustrations[i.id] = {
      id: i.id,
      label: slotLabel(i),
      src: withAsset(`/api/assets/${i.assetId}`)!,
      width: i.asset?.width ?? null,
      height: i.asset?.height ?? null,
      focalX: i.focalX,
      focalY: i.focalY,
      zoom: i.zoom,
      fit: i.fit === "cover" || i.fit === "contain" ? i.fit : null,
      isSketch: i.isSketch,
      isDemo: i.isDemo,
      status: i.status,
      targetRatio: i.targetRatio,
      autoFocalX: i.asset?.focalX ?? null,
      autoFocalY: i.asset?.focalY ?? null,
    };
    info.set(i.id, { width: i.asset?.width ?? null, height: i.asset?.height ?? null, contrast: i.asset?.contrast ?? null, isSketch: i.isSketch, isDemo: i.isDemo, fit: i.fit, zoom: i.zoom });
  }
  const issues = checkLayoutImages(pages, info);
  const inPages = all.filter((i) => referenced.has(i.id));
  const sketchN = inPages.filter((i) => i.isSketch).length;
  const imageState = !inPages.length ? "none" : sketchN === 0 ? "final" : sketchN === inPages.length ? "sketch" : "mixed";
  const spent = await prisma.generationLog.aggregate({ where: { bookId }, _sum: { costUsd: true } });
  const costUsd = Number(spent._sum.costUsd ?? 0);
  const { sites } = await loadSites().catch(() => ({ sites: [] as Awaited<ReturnType<typeof loadSites>>["sites"] }));
  const site = siteBySlug(sites, book.siteSlug);
  const lastPdf = await prisma.export.findFirst({ where: { bookId, status: "COMPLETED", kind: { in: ["BOOK_DIGITAL", "BOOK_PRINT"] }, assetId: { not: null } }, orderBy: { createdAt: "desc" } });
  const active = await prisma.export.findFirst({ where: { bookId, status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" } });
  return {
    book: {
      id: book.id,
      title: book.title,
      universe: site?.name ?? book.siteSlug ?? null,
      typeLabel: BOOK_TYPES.find((t) => t.key === book.bookType)?.label ?? kitLabel(book.kitType),
      status: book.status,
      pageCount: pages.length,
      costUsd,
      costLabel: formatUsd(costUsd),
      imageState,
      shopPublishedAt: book.shopPublishedAt?.toISOString() ?? null,
      shopPublicUrl: book.shopPublicUrl,
    },
    widthMm: ctx.widthMm,
    heightMm: ctx.heightMm,
    theme: ctx.theme,
    marginMm: ctx.theme.marginMm,
    pages: pages.map((p, i) => ({ ...p, number: numbers[i] })),
    illustrations,
    issues,
    sketches: await sketchSummary(bookId),
    latestPdf: lastPdf?.assetId ? { exportId: lastPdf.id, assetId: lastPdf.assetId, createdAt: lastPdf.createdAt.toISOString(), pageCount: lastPdf.pageCount } : null,
    activeExport: active ? { exportId: active.id, status: active.status } : null,
  };
}
