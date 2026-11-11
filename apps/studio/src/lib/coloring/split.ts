import sharp from "sharp";
import { toLineArt } from "../images/lineart";

/**
 * Découpage des planches de coloriage produites dans ChatGPT (2×2 ou 3×3 dessins par image) :
 * détection des gouttières blanches par profils de projection, repli sur une découpe
 * régulière, rognage de chaque dessin sur son contenu, noir et blanc pur, vectorisation.
 */

export type SheetGrid = 1 | 4 | 9;

export function gridSide(grid: SheetGrid): number {
  return grid === 9 ? 3 : grid === 4 ? 2 : 1;
}

/** Profil d'encre (part de pixels sombres) par ligne et par colonne. */
async function inkProfiles(data: Buffer, threshold = 160): Promise<{ rows: Float64Array; cols: Float64Array; width: number; height: number }> {
  const { data: px, info } = await sharp(data).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const rows = new Float64Array(H);
  const cols = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[y * W + x] < threshold) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  for (let y = 0; y < H; y++) rows[y] /= W;
  for (let x = 0; x < W; x++) cols[x] /= H;
  return { rows, cols, width: W, height: H };
}

/**
 * Positions de coupe le long d'un axe : pour chaque coupe attendue (k/n), le centre de la plus
 * longue bande blanche proche (±18 % de la longueur). null si une gouttière est introuvable.
 */
export function findCuts(profile: ArrayLike<number>, n: number, opts: { blank?: number; minRun?: number; window?: number } = {}): number[] | null {
  const L = profile.length;
  const blank = opts.blank ?? 0.002;
  const minRun = Math.max(2, Math.round((opts.minRun ?? 0.008) * L));
  const win = (opts.window ?? 0.18) * L;
  // Bandes blanches [début, fin]
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= L; i++) {
    const white = i < L && profile[i] <= blank;
    if (white && start < 0) start = i;
    if (!white && start >= 0) {
      if (i - start >= minRun) runs.push([start, i - 1]);
      start = -1;
    }
  }
  const cuts: number[] = [];
  for (let k = 1; k < n; k++) {
    const expected = (k * L) / n;
    const candidates = runs.filter(([a, b]) => b > expected - win && a < expected + win && a > 0 && b < L - 1);
    if (!candidates.length) return null;
    const best = candidates.sort((r1, r2) => r2[1] - r2[0] - (r1[1] - r1[0]) || Math.abs((r1[0] + r1[1]) / 2 - expected) - Math.abs((r2[0] + r2[1]) / 2 - expected))[0];
    cuts.push(Math.round((best[0] + best[1]) / 2));
  }
  return cuts;
}

export interface SplitResult {
  cells: Buffer[];
  /** Coupes utilisées (px) : x puis y */
  cutsX: number[];
  cutsY: number[];
  /** true : gouttières introuvables, découpe régulière selon la grille */
  fallback: boolean;
  width: number;
  height: number;
}

/** Découpe une planche en cases (ordre de lecture : gauche → droite, haut → bas). */
export async function splitSheet(data: Buffer, grid: SheetGrid, manual?: { cutsX: number[]; cutsY: number[] }): Promise<SplitResult> {
  const n = gridSide(grid);
  const meta = await sharp(data).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (n === 1) return { cells: [data], cutsX: [], cutsY: [], fallback: false, width: W, height: H };
  let cutsX = manual?.cutsX;
  let cutsY = manual?.cutsY;
  let fallback = false;
  if (!cutsX || !cutsY) {
    const prof = await inkProfiles(data);
    cutsX = findCuts(prof.cols, n) ?? undefined;
    cutsY = findCuts(prof.rows, n) ?? undefined;
    if (!cutsX || !cutsY) {
      fallback = true;
      cutsX = cutsX ?? Array.from({ length: n - 1 }, (_, k) => Math.round(((k + 1) * W) / n));
      cutsY = cutsY ?? Array.from({ length: n - 1 }, (_, k) => Math.round(((k + 1) * H) / n));
    }
  }
  const xs = [0, ...cutsX, W];
  const ys = [0, ...cutsY, H];
  const cells: Buffer[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const left = xs[c];
      const top = ys[r];
      const width = Math.max(1, xs[c + 1] - left);
      const height = Math.max(1, ys[r + 1] - top);
      cells.push(await sharp(data).extract({ left, top, width, height }).png().toBuffer());
    }
  }
  return { cells, cutsX, cutsY, fallback, width: W, height: H };
}

/** Rogne un dessin sur son contenu (trait) avec une marge blanche ; renvoie l'image d'origine si vide. */
export async function cropToContent(data: Buffer, marginRatio = 0.05): Promise<Buffer> {
  const { data: px, info } = await sharp(data).flatten({ background: "#ffffff" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[y * W + x] < 160) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return data;
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const margin = Math.round(Math.max(cw, ch) * marginRatio);
  const cropped = await sharp(data).extract({ left: minX, top: minY, width: cw, height: ch }).png().toBuffer();
  return sharp(cropped).extend({ top: margin, bottom: margin, left: margin, right: margin, background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer();
}

/** Agrandissement net (repli raster si la vectorisation échoue) : ×2 ou ×3 puis seuillage. */
export async function upscaleLineArt(data: Buffer, minSide = 1800): Promise<Buffer> {
  const meta = await sharp(data).metadata();
  const side = Math.max(meta.width ?? 0, meta.height ?? 0);
  const factor = side >= minSide ? 1 : side * 2 >= minSide ? 2 : 3;
  const big = factor > 1 ? await sharp(data).resize({ width: (meta.width ?? 1) * factor, height: (meta.height ?? 1) * factor, kernel: "lanczos3" }).png().toBuffer() : data;
  return toLineArt(big);
}

/**
 * Vectorisation du trait (imagetracerjs, domaine public) : SVG noir sur blanc à intégrer tel
 * quel dans la page / le PDF, net à toutes les tailles. null si l'image ne se vectorise pas.
 */
export async function vectorizeLineArt(data: Buffer, maxSide = 1600): Promise<{ svg: string; width: number; height: number } | null> {
  try {
    // Niveaux de gris sur 1 canal, seuillés, puis RGBA construit à la main (format attendu par le traceur)
    const { data: gray, info } = await sharp(data).flatten({ background: "#ffffff" }).resize({ width: maxSide, height: maxSide, fit: "inside", kernel: "lanczos3" }).grayscale().threshold(175).raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    const rgba = new Uint8ClampedArray(n * 4);
    let ink = 0;
    for (let i = 0; i < n; i++) {
      const v = gray[i * info.channels] < 128 ? 0 : 255;
      if (v === 0) ink++;
      rgba[i * 4] = v;
      rgba[i * 4 + 1] = v;
      rgba[i * 4 + 2] = v;
      rgba[i * 4 + 3] = 255;
    }
    if (ink / n < 0.0005) return null; // image vide : rien à vectoriser
    const mod = (await import("imagetracerjs")) as unknown as { default?: ImageTracerApi } & ImageTracerApi;
    const tracer: ImageTracerApi = mod.default ?? mod;
    const raw = tracer.imagedataToSVG(
      { width: info.width, height: info.height, data: rgba },
      { pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }], colorquantcycles: 1, ltres: 0.5, qtres: 0.5, pathomit: 4, rightangleenhance: false, strokewidth: 0, linefilter: false, roundcoords: 1, viewbox: true, desc: false },
    );
    if (!raw || !/<path[^>]*fill="rgb\(0,0,0\)"/.test(raw)) return null;
    // Fond blanc explicite + dimensions intrinsèques (affichage <img> et PDF)
    const svg = raw.replace(/<svg ([^>]*)>/, `<svg $1 width="${info.width}" height="${info.height}"><rect width="100%" height="100%" fill="#ffffff"/>`).replace(/ desc="[^"]*"/, "");
    return { svg, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

interface ImageTracerApi {
  imagedataToSVG(img: { width: number; height: number; data: Uint8ClampedArray }, options: Record<string, unknown>): string;
}

/** Ordre des fichiers déposés : nom (les téléchargements ChatGPT contiennent date et heure), puis date de modification. */
export function orderUploads<T extends { name: string; lastModified?: number }>(files: T[]): T[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" }) || (a.lastModified ?? 0) - (b.lastModified ?? 0));
}

/** Traitement complet d'une case : rognage, noir et blanc, vectorisation (repli raster agrandi). */
export async function processCell(cell: Buffer): Promise<{ png: Buffer; svg: string | null; width: number; height: number }> {
  const cropped = await cropToContent(cell);
  const bw = await toLineArt(cropped);
  const vec = await vectorizeLineArt(bw);
  const png = vec ? bw : await upscaleLineArt(bw);
  const meta = await sharp(png).metadata();
  return { png, svg: vec?.svg ?? null, width: vec?.width ?? meta.width ?? 0, height: vec?.height ?? meta.height ?? 0 };
}
