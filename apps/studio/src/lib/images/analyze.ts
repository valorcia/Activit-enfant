import sharp from "sharp";

/**
 * Analyse automatique et gratuite d'une image (sharp, aucun appel IA) :
 * - point focal (zone d'intérêt) par la stratégie « attention » de sharp, « entropy » en repli ;
 * - couleur moyenne (fond des images ajustées sans bandes noires) ;
 * - contraste (écart type moyen des canaux) pour repérer une image quasi vide.
 */
export interface ImageAnalysis {
  width: number;
  height: number;
  focalX: number;
  focalY: number;
  dominantColor: string;
  contrast: number;
}

const WORK = 384; // taille de travail : rapide, suffisante pour la zone d'intérêt

async function cropOffset(img: Buffer, w: number, h: number, strategy: number): Promise<{ left: number; top: number }> {
  const { info } = await sharp(img).resize({ width: w, height: h, fit: "cover", position: strategy }).toBuffer({ resolveWithObject: true });
  const i = info as unknown as { cropOffsetLeft?: number; cropOffsetTop?: number };
  return { left: Math.abs(i.cropOffsetLeft ?? 0), top: Math.abs(i.cropOffsetTop ?? 0) };
}

/** Zone d'intérêt → point focal (0–1) : centre d'une fenêtre de la moitié de l'image, sur chaque axe. */
export async function focalPoint(data: Buffer, strategy: "attention" | "entropy" = "attention"): Promise<{ focalX: number; focalY: number }> {
  const work = await sharp(data).resize({ width: WORK, height: WORK, fit: "inside" }).toBuffer({ resolveWithObject: true });
  const W = work.info.width;
  const H = work.info.height;
  const strat = strategy === "attention" ? sharp.strategy.attention : sharp.strategy.entropy;
  const half = (n: number) => Math.max(1, Math.round(n / 2));
  // Axe horizontal : fenêtre de largeur W/2 sur toute la hauteur
  const hx = await cropOffset(work.data, half(W), H, strat);
  // Axe vertical : fenêtre de hauteur H/2 sur toute la largeur
  const vy = await cropOffset(work.data, W, half(H), strat);
  const focalX = (hx.left + half(W) / 2) / W;
  const focalY = (vy.top + half(H) / 2) / H;
  return { focalX: round(clamp(focalX)), focalY: round(clamp(focalY)) };
}

export async function analyzeImage(data: Buffer): Promise<ImageAnalysis> {
  const meta = await sharp(data).metadata();
  const stats = await sharp(data).removeAlpha().stats();
  const ch = stats.channels.slice(0, 3);
  const mean = ch.map((c) => Math.round(c.mean));
  const contrast = ch.reduce((a, c) => a + c.stdev, 0) / Math.max(1, ch.length);
  let focal = { focalX: 0.5, focalY: 0.5 };
  if (contrast >= UNIFORM_CONTRAST) try {
    focal = await focalPoint(data, "attention");
  } catch {
    try {
      focal = await focalPoint(data, "entropy");
    } catch {
      /* image illisible : centre */
    }
  }
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    ...focal,
    dominantColor: `#${mean.map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0")).join("")}`,
    contrast: round(contrast),
  };
}

/** Image quasi uniforme (vide, unie, ratée) : contraste très faible. */
export const UNIFORM_CONTRAST = 6;

function clamp(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5));
}
function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
