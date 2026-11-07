import { BookThemeSchema, type BookTheme } from "../schemas/layout";

export const BUILTIN_TEMPLATES: { key: string; name: string; description: string; theme: BookTheme }[] = [
  {
    key: "atelier",
    name: "Atelier",
    description: "Bleu confiant et jaune soleil, titres arrondis. Idéal inventions et sciences.",
    theme: BookThemeSchema.parse({ templateKey: "atelier", colorPrimary: "#1d4ed8", colorSecondary: "#f59e0b", colorAccent: "#10b981", colorPanel: "#eff6ff" }),
  },
  {
    key: "foret",
    name: "Forêt",
    description: "Verts profonds et terre cuite. Idéal nature et bricolages.",
    theme: BookThemeSchema.parse({ templateKey: "foret", colorPrimary: "#166534", colorSecondary: "#c2410c", colorAccent: "#ca8a04", colorPanel: "#f0fdf4", headingStyle: "classic" }),
  },
  {
    key: "bonbon",
    name: "Bonbon",
    description: "Rose, violet et menthe, ambiance ludique. Idéal préscolaire et créativité.",
    theme: BookThemeSchema.parse({ templateKey: "bonbon", colorPrimary: "#be185d", colorSecondary: "#7c3aed", colorAccent: "#14b8a6", colorPanel: "#fdf2f8", headingStyle: "playful", fontHeading: "Baloo 2" }),
  },
  {
    key: "ardoise",
    name: "Ardoise",
    description: "Gris ardoise et orange, sobre et lisible. Idéal 9-12 ans.",
    theme: BookThemeSchema.parse({ templateKey: "ardoise", colorPrimary: "#334155", colorSecondary: "#ea580c", colorAccent: "#0ea5e9", colorPanel: "#f1f5f9", headingStyle: "classic", fontHeading: "Fredoka" }),
  },
];

export function themeFor(raw: unknown): BookTheme {
  const parsed = BookThemeSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : BUILTIN_TEMPLATES[0].theme;
}

export function defaultThemeForBook(bookType: string, ageRange: string): BookTheme {
  if (bookType === "nature" || bookType === "bricolages") return BUILTIN_TEMPLATES[1].theme;
  if (bookType === "prescolaire" || bookType === "creativite" || ageRange === "3-5") return BUILTIN_TEMPLATES[2].theme;
  if (ageRange === "9-12") return BUILTIN_TEMPLATES[3].theme;
  return BUILTIN_TEMPLATES[0].theme;
}
