import { prisma } from "../db";
import { PageLayoutSchema, type PageLayout } from "../schemas/layout";
import { AUTO_CONTAIN_MISMATCH, DPI_BLOCK, DPI_WARN, effectiveDpi, effectiveFit, ratioMismatch } from "../images/framing";
import { UNIFORM_CONTRAST } from "../images/analyze";

/**
 * Contrôle qualité des images d'un livre, sans appel IA : résolution à l'impression,
 * écart de format avec le cadre, image quasi uniforme, image absente, esquisse.
 * Même calcul que le rendu (aperçu = PDF), pour des alertes fiables.
 */
export type ImageIssueCode = "missing" | "dpi_low" | "dpi_blocking" | "ratio_mismatch" | "auto_contain" | "uniform" | "sketch" | "demo";
export type ImageIssueAction = "recadrer" | "remplacer" | "regenerer";

export interface ImageIssue {
  pageIndex: number;
  pageId?: string;
  blockId: string;
  illustrationId?: string;
  code: ImageIssueCode;
  severity: "info" | "warning" | "blocking";
  message: string;
  actions: ImageIssueAction[];
  dpi?: number;
  mismatch?: number;
}

export interface ImageInfo {
  width: number | null;
  height: number | null;
  contrast: number | null;
  isSketch: boolean;
  isDemo: boolean;
  fit: string | null;
  zoom: number;
}

/** Fonction pure : contrôle des blocs image d'un ensemble de pages. */
export function checkLayoutImages(pages: { id?: string; layout: PageLayout }[], ills: Map<string, ImageInfo>): ImageIssue[] {
  const issues: ImageIssue[] = [];
  pages.forEach((p, pageIndex) => {
    for (const b of p.layout.blocks) {
      if (b.type !== "image") continue;
      const base = { pageIndex, pageId: p.id, blockId: b.id, illustrationId: b.illustrationId };
      if (!b.src) {
        issues.push({ ...base, code: "missing", severity: "warning", message: "Image manquante : le cadre est vide", actions: ["remplacer", "regenerer"] });
        continue;
      }
      const ill = b.illustrationId ? ills.get(b.illustrationId) : undefined;
      if (!ill) continue;
      if (ill.isSketch) issues.push({ ...base, code: "sketch", severity: "info", message: "Esquisse : à valider avant la version finale", actions: ["regenerer"] });
      if (ill.isDemo) issues.push({ ...base, code: "demo", severity: "info", message: "Image de démonstration (pas une illustration définitive)", actions: ["remplacer", "regenerer"] });
      if (ill.width && ill.height) {
        const mismatch = ratioMismatch(ill.width, ill.height, b.w, b.h);
        // Même règle que l'assemblage des pages (applyFramingToLayout)
        const fit = effectiveFit({ fit: ill.fit, imgW: ill.width, imgH: ill.height, frameW: b.w, frameH: b.h });
        if (mismatch > AUTO_CONTAIN_MISMATCH) {
          if (fit === "cover") issues.push({ ...base, code: "ratio_mismatch", severity: "warning", message: `Format très différent du cadre (${Math.round(mismatch * 100)} %) : une partie de l'image est coupée, recadrage conseillé`, actions: ["recadrer"], mismatch });
          else issues.push({ ...base, code: "auto_contain", severity: "info", message: `Format différent du cadre (${Math.round(mismatch * 100)} %) : image ajustée sans coupe`, actions: ["recadrer"], mismatch });
        }
        const dpi = effectiveDpi({ imgW: ill.width, imgH: ill.height, frameWmm: b.w, frameHmm: b.h, fit, zoom: ill.zoom });
        if (dpi < DPI_BLOCK) issues.push({ ...base, code: "dpi_blocking", severity: "blocking", message: `Résolution insuffisante pour l'impression (${dpi} ppp, minimum ${DPI_BLOCK})`, actions: ["recadrer", "remplacer", "regenerer"], dpi });
        else if (dpi < DPI_WARN) issues.push({ ...base, code: "dpi_low", severity: "warning", message: `Résolution limite à l'impression (${dpi} ppp, conseillé ${DPI_WARN})`, actions: ["recadrer", "remplacer"], dpi });
      }
      if (ill.contrast != null && ill.contrast < UNIFORM_CONTRAST) issues.push({ ...base, code: "uniform", severity: "warning", message: "Image presque unie : génération probablement ratée", actions: ["remplacer", "regenerer"] });
    }
  });
  return issues;
}

/** Contrôle des images d'un livre (pages enregistrées). */
export async function checkBookImages(bookId: string) {
  const rows = await prisma.bookPage.findMany({ where: { bookId }, orderBy: { position: "asc" } });
  const pages = rows.flatMap((r) => {
    const l = PageLayoutSchema.safeParse(r.layout);
    return l.success ? [{ id: r.id, layout: l.data }] : [];
  });
  const ids = new Set<string>();
  for (const p of pages) for (const b of p.layout.blocks) if (b.type === "image" && b.illustrationId) ids.add(b.illustrationId);
  const ills = await prisma.illustration.findMany({ where: { id: { in: [...ids] } }, include: { asset: true } });
  const map = new Map<string, ImageInfo>(ills.map((i) => [i.id, { width: i.asset?.width ?? null, height: i.asset?.height ?? null, contrast: i.asset?.contrast ?? null, isSketch: i.isSketch, isDemo: i.isDemo, fit: i.fit, zoom: i.zoom }]));
  const issues = checkLayoutImages(pages, map);
  return {
    issues,
    blocking: issues.filter((i) => i.severity === "blocking").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    sketches: new Set(issues.filter((i) => i.code === "sketch").map((i) => i.illustrationId)).size,
  };
}

export function summarizeImageIssues(r: { blocking: number; warnings: number; sketches: number }): string {
  const parts: string[] = [];
  if (r.blocking) parts.push(`${r.blocking} image(s) bloquante(s)`);
  if (r.warnings) parts.push(`${r.warnings} alerte(s) image`);
  if (r.sketches) parts.push(`${r.sketches} esquisse(s) à finaliser`);
  return parts.length ? parts.join(" · ") : "Images conformes";
}
