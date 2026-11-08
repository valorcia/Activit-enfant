import { BookThemeSchema, type BookTheme } from "../schemas/layout";
import { isStructuredKit } from "../kits/types";
import { PRESETS, type UniversePreset } from "../universes/presets";

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
    key: "malle",
    name: "La Malle à Jeux",
    description: "Bleu marine, rouge pirate et vert d'eau sur fond crème : l'identité des kits La Malle à Jeux.",
    theme: BookThemeSchema.parse({ templateKey: "malle", colorPrimary: "#1F3A5F", colorSecondary: "#C0392B", colorAccent: "#2E8B7A", colorText: "#293241", colorPanel: "#FFF9F0", headingStyle: "playful", fontHeading: "Fredoka" }),
  },
  {
    key: "ardoise",
    name: "Ardoise",
    description: "Gris ardoise et orange, sobre et lisible. Idéal 9-12 ans.",
    theme: BookThemeSchema.parse({ templateKey: "ardoise", colorPrimary: "#334155", colorSecondary: "#ea580c", colorAccent: "#0ea5e9", colorPanel: "#f1f5f9", headingStyle: "classic", fontHeading: "Fredoka" }),
  },
  {
    key: "expert",
    name: "Guide expert",
    description: "Bleus d'eau, sarcelle et blanc, titres sobres : guides pratiques pour adultes.",
    theme: BookThemeSchema.parse({ templateKey: "expert", colorPrimary: "#1E4E79", colorSecondary: "#2BA6A4", colorAccent: "#E0A526", colorText: "#1F2933", colorPanel: "#EEF6FA", headingStyle: "classic", fontHeading: "Nunito", fontBody: "Nunito" }),
  },
  {
    key: "recettes",
    name: "Recettes",
    description: "Tomate, olive et crème, ambiance cuisine familiale.",
    theme: BookThemeSchema.parse({ templateKey: "recettes", colorPrimary: "#9B2C2C", colorSecondary: "#5F7A3A", colorAccent: "#D69E2E", colorText: "#2D2A26", colorPanel: "#FFF8EE", headingStyle: "classic", fontHeading: "Baloo 2" }),
  },
  {
    key: "labo",
    name: "Labo des curieux",
    description: "Violet, cyan et jaune : fiches d'expériences scientifiques pour enfants.",
    theme: BookThemeSchema.parse({ templateKey: "labo", colorPrimary: "#4C1D95", colorSecondary: "#0891B2", colorAccent: "#F59E0B", colorText: "#1E1B4B", colorPanel: "#F5F3FF", headingStyle: "playful", fontHeading: "Fredoka" }),
  },
];

/** Thème PDF par défaut d'un préréglage d'univers. */
export function themeForPreset(p: UniversePreset): BookTheme {
  const key = PRESETS[p]?.themeKey ?? "malle";
  return (BUILTIN_TEMPLATES.find((t) => t.key === key) ?? BUILTIN_TEMPLATES[0]).theme;
}

export function themeFor(raw: unknown): BookTheme {
  const parsed = BookThemeSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : BUILTIN_TEMPLATES[0].theme;
}

export function defaultThemeForBook(bookType: string, ageRange: string): BookTheme {
  if (bookType === "kit" || isStructuredKit(bookType)) return BUILTIN_TEMPLATES.find((t) => t.key === "malle")!.theme;
  if (bookType === "nature" || bookType === "bricolages") return BUILTIN_TEMPLATES[1].theme;
  if (bookType === "prescolaire" || bookType === "creativite" || ageRange === "3-5") return BUILTIN_TEMPLATES[2].theme;
  if (ageRange === "9-12") return BUILTIN_TEMPLATES[3].theme;
  return BUILTIN_TEMPLATES[0].theme;
}
