import sharp from "sharp";
import type { ImageProvider, ImageRequest, ImageResult } from "../types";

/**
 * Fournisseur d'images de démonstration. Produit une image PNG clairement
 * étiquetée « IMAGE DE DÉMONSTRATION » contenant le résumé du prompt.
 * Elle n'est JAMAIS considérée comme une illustration définitive (isDemo = true).
 */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  async generate(req: ImageRequest): Promise<ImageResult> {
    const [w, h] = req.size.split("x").map(Number);
    const label = (req.label ?? "Illustration").slice(0, 60);
    const lines = wrap(req.prompt.replace(/\s+/g, " ").slice(0, 420), 46);
    const hue = hash(req.prompt) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},45%,88%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},45%,78%)"/>
    </linearGradient>
    <pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="2" fill="hsl(${hue},40%,60%)" opacity="0.35"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#p)"/>
  <rect x="${w * 0.08}" y="${h * 0.1}" width="${w * 0.84}" height="${h * 0.8}" rx="28" fill="white" opacity="0.85" stroke="hsl(${hue},40%,50%)" stroke-width="6" stroke-dasharray="18 12"/>
  <text x="50%" y="${h * 0.21}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.045}" font-weight="bold" fill="#b91c1c">IMAGE DE DÉMONSTRATION</text>
  <text x="50%" y="${h * 0.27}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.026}" fill="#7f1d1d">Aucun fournisseur d'images configuré — à remplacer</text>
  <text x="50%" y="${h * 0.36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.034}" font-weight="bold" fill="#1f2937">${esc(label)}</text>
  ${lines
    .slice(0, 9)
    .map((l, i) => `<text x="50%" y="${h * 0.44 + i * w * 0.032}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.024}" fill="#374151">${esc(l)}</text>`)
    .join("\n")}
  <text x="50%" y="${h * 0.86}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.022}" fill="#6b7280">Inventor Studio · aperçu de mise en page uniquement</text>
</svg>`;
    const data = await sharp(Buffer.from(svg)).png().toBuffer();
    await new Promise((r) => setTimeout(r, 100));
    return { data, mime: "image/png", width: w, height: h, costUsd: 0, provider: this.name, model: "mock", isDemo: true };
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function wrap(text: string, width: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    if ((cur + " " + wd).trim().length > width) {
      lines.push(cur.trim());
      cur = wd;
    } else cur += " " + wd;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
