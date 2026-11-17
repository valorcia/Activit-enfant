/**
 * Thème de livre « unwritten » : couleurs et polices du design system UNWRITTEN, exprimés
 * dans le schéma de thème existant (BookThemeSchema) pour passer par le rendu et l'export
 * PDF habituels. Ce thème n'est pas ajouté aux modèles proposés aux livres La Malle à Jeux.
 */
import { BookThemeSchema, type BookTheme } from "../schemas/layout";
import { DERIVED, PALETTE } from "./palette";
import { FONT_DISPLAY, FONT_TEXT } from "./fonts";
import type { EditorialGrid } from "./grid";

export const UNWRITTEN_TEMPLATE_KEY = "unwritten";

export function unwrittenTheme(grid?: EditorialGrid): BookTheme {
  return BookThemeSchema.parse({
    templateKey: UNWRITTEN_TEMPLATE_KEY,
    fontHeading: FONT_DISPLAY,
    fontBody: FONT_TEXT,
    colorPrimary: PALETTE.ink,
    colorSecondary: PALETTE.champagne,
    colorAccent: PALETTE.stone,
    colorText: PALETTE.ink,
    colorBackground: PALETTE.ivory,
    colorPanel: PALETTE.white,
    marginMm: Math.min(30, Math.max(5, grid?.outer ?? 16)),
    bleedMm: 0,
    baseFontPt: grid?.bodyPt ?? 10.25,
    headingStyle: "classic",
  });
}

export const UNWRITTEN_THEME = unwrittenTheme();

/** Couleurs d'usage (voir § 2 du design system). */
export const INK = {
  text: PALETTE.ink,
  secondary: DERIVED.graphite,
  accentText: DERIVED.bronze,
  rule: PALETTE.champagne,
  hairline: PALETTE.stone,
  paper: PALETTE.ivory,
  white: PALETTE.white,
  night: PALETTE.ink,
  onNight: PALETTE.ivory,
  champagne: PALETTE.champagne,
} as const;
