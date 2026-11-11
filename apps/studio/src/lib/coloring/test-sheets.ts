import sharp from "sharp";

/**
 * Planches de test (dessins simples au trait) : utilisées par les tests et le script de
 * démonstration du copier-coller « en lot ». Aucune IA : formes géométriques en SVG.
 */
const SHAPES = [
  (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx - r / 3}" cy="${cy - r / 4}" r="${r / 8}"/><circle cx="${cx + r / 3}" cy="${cy - r / 4}" r="${r / 8}"/><path d="M ${cx - r / 2} ${cy + r / 4} Q ${cx} ${cy + r / 1.6} ${cx + r / 2} ${cy + r / 4}"/>`,
  (cx: number, cy: number, r: number) => `<rect x="${cx - r}" y="${cy - r * 0.6}" width="${r * 2}" height="${r * 1.2}" rx="${r / 5}"/><circle cx="${cx - r / 2}" cy="${cy + r * 0.75}" r="${r / 4}"/><circle cx="${cx + r / 2}" cy="${cy + r * 0.75}" r="${r / 4}"/>`,
  (cx: number, cy: number, r: number) => `<polygon points="${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}"/><circle cx="${cx}" cy="${cy + r * 0.2}" r="${r / 4}"/>`,
  (cx: number, cy: number, r: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.6}"/><path d="M ${cx + r} ${cy} L ${cx + r * 1.4} ${cy - r / 2} L ${cx + r * 1.4} ${cy + r / 2} Z"/><circle cx="${cx - r / 2}" cy="${cy - r / 6}" r="${r / 10}"/>`,
];

/** Planche portrait W×H en grille n×n avec gouttières blanches (gutter px) ; `gutter: 0` = dessins qui touchent la coupe. */
export async function makeTestSheet(o: { side: number; width?: number; height?: number; gutter?: number; seed?: number; stroke?: number }): Promise<Buffer> {
  const W = o.width ?? 1024;
  const H = o.height ?? 1536;
  const n = o.side;
  const gutter = o.gutter ?? 60;
  const stroke = o.stroke ?? 10;
  const cw = (W - gutter * (n - 1)) / n;
  const ch = (H - gutter * (n - 1)) / n;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x0 = c * (cw + gutter);
      const y0 = r * (ch + gutter);
      const cx = x0 + cw / 2;
      const cy = y0 + ch / 2;
      // gutter 0 : le dessin déborde volontairement jusqu'aux bords de la case (pas de bande blanche)
      const rad = gutter === 0 ? Math.min(cw, ch) * 0.52 : Math.min(cw, ch) * 0.32;
      parts.push(SHAPES[((o.seed ?? 0) + r * n + c) % SHAPES.length](cx, cy, rad));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#ffffff"/><g fill="none" stroke="#000000" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round">${parts.join("")}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
