import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { adPropsSchema, type AdFormat, type AdPropsInput } from "./schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(here, "remotion", "index.ts");

export const COMPOSITION_IDS: Record<AdFormat, string> = { story: "AdStory", square: "AdSquare", landscape: "AdLandscape" };

/** Chromium déjà présent sur la machine (CHROMIUM_PATH, Playwright) ; sinon Remotion télécharge le sien. */
export function findBrowser(): string | undefined {
  const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"].filter(Boolean) as string[];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    const st = fs.statSync(c);
    if (st.isFile()) return c;
    // Dossier Playwright : chercher l'exécutable chrome
    const nested = ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome"].map((p) => path.join(c, p)).find((p) => fs.existsSync(p));
    if (nested) return nested;
  }
  return undefined;
}

let bundled: Promise<string> | null = null;
/** Le bundle webpack est construit une fois par processus. `publicDir` sert les fichiers locaux (images, clips, musique). */
function getBundle(publicDir?: string): Promise<string> {
  if (!bundled) bundled = bundle({ entryPoint: ENTRY, publicDir: publicDir ?? null, onProgress: () => undefined });
  return bundled;
}

export interface RenderOptions {
  format?: AdFormat;
  outPath: string;
  /** Dossier contenant les fichiers locaux référencés par chemin relatif dans les props. */
  publicDir?: string;
  /** Réduction de résolution (ex. 1/3 pour un aperçu rapide). */
  scale?: number;
  crf?: number;
  onProgress?: (progress: number) => void;
}

export async function renderAd(input: AdPropsInput, opts: RenderOptions): Promise<{ outPath: string; durationSeconds: number }> {
  const props = adPropsSchema.parse({ ...input, format: opts.format ?? input.format ?? "story" });
  const serveUrl = await getBundle(opts.publicDir);
  const browserExecutable = findBrowser() ?? null;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_IDS[props.format], inputProps: props, browserExecutable });
  fs.mkdirSync(path.dirname(path.resolve(opts.outPath)), { recursive: true });
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: opts.crf ?? 20,
    pixelFormat: "yuv420p",
    scale: opts.scale ?? 1,
    inputProps: props,
    outputLocation: opts.outPath,
    browserExecutable,
    chromiumOptions: { gl: "swangle" },
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
  return { outPath: opts.outPath, durationSeconds: props.durationSeconds };
}

/** Miniature (image fixe) à un instant donné de la vidéo, par défaut sur la scène d'offre. */
export async function renderAdStill(input: AdPropsInput, opts: { format?: AdFormat; outPath: string; frame?: number; publicDir?: string; scale?: number }) {
  const props = adPropsSchema.parse({ ...input, format: opts.format ?? input.format ?? "story" });
  const serveUrl = await getBundle(opts.publicDir);
  const browserExecutable = findBrowser() ?? null;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_IDS[props.format], inputProps: props, browserExecutable });
  await renderStill({
    serveUrl,
    composition,
    inputProps: props,
    output: opts.outPath,
    frame: opts.frame ?? composition.durationInFrames - 15,
    scale: opts.scale ?? 1,
    browserExecutable,
  });
  return { outPath: opts.outPath };
}
