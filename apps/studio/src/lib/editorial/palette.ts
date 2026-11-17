/**
 * Palette UNWRITTEN et calcul des contrastes (WCAG 2.2, § 1.4.3).
 * Voir docs/unwritten/DESIGN_SYSTEM_UNWRITTEN.md § 2.
 */

/** Couleurs imposées par la charte. */
export const PALETTE = {
  ivory: "#F7F4EE",
  ink: "#171717",
  champagne: "#C5A77B",
  stone: "#A7A39B",
  white: "#FFFFFF",
} as const;

/**
 * Tons fonctionnels dérivés (assombris) pour le texte secondaire : la pierre et le champagne
 * purs n'atteignent pas 4,5:1 sur ivoire et restent réservés aux filets et ornements.
 */
export const DERIVED = {
  /** Pierre assombrie : titres courants, folios, légendes (5,13:1 sur ivoire) */
  graphite: "#6B675F",
  /** Champagne assombri : numéros de chapitre sur fond clair (5,07:1 sur ivoire) */
  bronze: "#7A6544",
} as const;

export type Rgba = { r: number; g: number; b: number; a: number };

/** Lit « #RGB », « #RRGGBB », « #RRGGBBAA », « rgb() » ou « rgba() ». Renvoie null si illisible. */
export function parseColor(input: string | null | undefined): Rgba | null {
  if (!input) return null;
  const c = input.trim().toLowerCase();
  if (c === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3})$/.exec(c);
  if (m) {
    const [r, g, b] = m[1].split("").map((x) => parseInt(x + x, 16));
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(c);
  if (m) {
    const n = m[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}

/** Superpose une couleur (éventuellement translucide) sur un fond opaque. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

/** Luminance relative WCAG. */
export function relativeLuminance(c: Rgba): number {
  const ch = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(fg: string | Rgba, bg: string | Rgba): number {
  const b = typeof bg === "string" ? parseColor(bg) : bg;
  const f0 = typeof fg === "string" ? parseColor(fg) : fg;
  if (!b || !f0) return NaN;
  const back = b.a < 1 ? composite(b, { r: 255, g: 255, b: 255, a: 1 }) : b;
  const f = f0.a < 1 ? composite(f0, back) : f0;
  const l1 = relativeLuminance(f);
  const l2 = relativeLuminance(back);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Seuil WCAG AA : 3:1 pour un grand texte (≥ 18 pt, ou ≥ 14 pt gras), 4,5:1 sinon. */
export function requiredContrast(fontSizePt: number, fontWeight: number): number {
  return fontSizePt >= 18 || (fontSizePt >= 14 && fontWeight >= 700) ? 3 : 4.5;
}
