import { z } from "zod";

// ---------------------------------------------------------------------------
// Thème graphique
// ---------------------------------------------------------------------------

export const BookThemeSchema = z.object({
  templateKey: z.string().default("atelier"),
  fontHeading: z.string().default("Nunito"),
  fontBody: z.string().default("Nunito"),
  colorPrimary: z.string().default("#1d4ed8"),
  colorSecondary: z.string().default("#f59e0b"),
  colorAccent: z.string().default("#10b981"),
  colorText: z.string().default("#1f2937"),
  colorBackground: z.string().default("#ffffff"),
  colorPanel: z.string().default("#eff6ff"),
  marginMm: z.number().min(5).max(30).default(15),
  bleedMm: z.number().min(0).max(5).default(0),
  baseFontPt: z.number().min(8).max(16).default(11),
  headingStyle: z.enum(["rounded", "classic", "playful"]).default("rounded"),
});
export type BookTheme = z.infer<typeof BookThemeSchema>;

// ---------------------------------------------------------------------------
// Blocs de page (positions en mm, origine en haut à gauche de la page)
// ---------------------------------------------------------------------------

const Rect = {
  x: z.number(),
  y: z.number(),
  w: z.number().min(1),
  h: z.number().min(1),
};

export const TextStyleSchema = z.object({
  fontSizePt: z.number().min(5).max(96).optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  background: z.string().optional(),
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  weight: z.enum(["normal", "bold"]).optional(),
  lineHeight: z.number().min(0.8).max(2.5).optional(),
  padding: z.number().min(0).max(30).optional(),
  radius: z.number().min(0).max(30).optional(),
  borderColor: z.string().optional(),
  /** Bordure en pointillés : lignes de découpe des cartes. */
  borderStyle: z.enum(["solid", "dashed"]).optional(),
  /** Débordement de texte vérifié et accepté (« Valider tel quel ») : plus d'alerte. */
  overflowOk: z.boolean().optional(),
  // --- Extensions typographiques (moteur éditorial UNWRITTEN) -----------------------
  // Toutes optionnelles : absentes, le rendu des pages existantes est strictement inchangé.
  /** Italique. */
  italic: z.boolean().optional(),
  /** Graisse numérique (polices variables : 300 léger, 400 normal, 500 medium…) ; prioritaire sur `weight`. */
  weightNum: z.number().min(100).max(900).optional(),
  /** Approche (interlettrage) en em, par ex. 0.18 pour des capitales espacées. */
  letterSpacingEm: z.number().min(-0.1).max(1).optional(),
  /** Capitales (transformation CSS : le texte stocké reste en casse normale). */
  uppercase: z.boolean().optional(),
  /** Alignement vertical du texte dans son cadre. */
  valign: z.enum(["top", "middle", "bottom"]).optional(),
  /** Réglages OpenType (`font-feature-settings`), par ex. "\"onum\" 1, \"liga\" 1". */
  features: z.string().max(120).optional(),
  /** Césure automatique selon la langue (`hyphens: auto`). */
  hyphenate: z.boolean().optional(),
  /** Langue du bloc (césure, guillemets) : « fr », « en »… */
  lang: z.string().max(12).optional(),
  /** Espace entre paragraphes (lignes séparées par « \n »), en mm. */
  paragraphGapMm: z.number().min(0).max(30).optional(),
  /** Taille fixe : pas d'ajustement automatique (la composition a été mesurée). */
  noAutofit: z.boolean().optional(),
  /** Épaisseur de trait (filets, cercles, cadres) en mm. */
  strokeMm: z.number().min(0.05).max(5).optional(),
  /** Opacité du bloc (0–1). */
  opacity: z.number().min(0).max(1).optional(),
  /** Lignes équilibrées (`text-wrap: balance`) : titres et citations centrés, jamais de mot seul. */
  balance: z.boolean().optional(),
  /** Rotation du bloc autour de son centre, en degrés (filets obliques des couvertures). */
  rotateDeg: z.number().min(-180).max(180).optional(),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextBlockSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  role: z.enum(["title", "subtitle", "heading", "body", "caption", "label", "pageNumber"]).default("body"),
  text: z.string(),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const ListBlockSchema = z.object({
  id: z.string(),
  type: z.literal("list"),
  role: z.enum(["materials", "warnings", "bullets", "keywords"]).default("bullets"),
  items: z.array(z.string()),
  title: z.string().optional(),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const StepBlockSchema = z.object({
  id: z.string(),
  type: z.literal("step"),
  number: z.number().int().min(1),
  title: z.string(),
  instruction: z.string(),
  tip: z.string().default(""),
  adultHelp: z.boolean().default(false),
  illustrationId: z.string().optional(),
  imageSrc: z.string().optional(),
  isDemo: z.boolean().default(false),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const ImageBlockSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  role: z.enum(["final", "step", "cover", "decoration"]).default("final"),
  illustrationId: z.string().optional(),
  src: z.string().optional(), // URL servie par l'app (/api/assets/...)
  alt: z.string().default(""),
  caption: z.string().default(""),
  isDemo: z.boolean().default(false),
  fit: z.enum(["contain", "cover"]).default("contain"),
  /** Cadrage (copié depuis l'illustration) : point focal 0–1, zoom 1–3, couleur de fond en mode « ajuster » */
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
  zoom: z.number().min(1).max(3).optional(),
  bg: z.string().optional(),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const BadgeBlockSchema = z.object({
  id: z.string(),
  type: z.literal("badges"),
  items: z.array(z.object({ label: z.string(), value: z.string(), icon: z.string().optional() })),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const ShapeBlockSchema = z.object({
  id: z.string(),
  type: z.literal("shape"),
  /** « rule » : filet horizontal (ou vertical si h > w) centré dans le cadre, épaisseur `style.strokeMm`. */
  shape: z.enum(["rect", "band", "circle", "rule"]).default("rect"),
  color: z.string().default("#eff6ff"),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(true),
});

export const TocBlockSchema = z.object({
  id: z.string(),
  type: z.literal("toc"),
  entries: z.array(z.object({ number: z.number().int(), title: z.string(), page: z.number().int() })),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Texte composé (moteur éditorial) : fragment d'un flux de texte paginé après mesure
// réelle dans Chromium. Chaque élément porte ses propres réglages ; le rendu est
// partagé entre la mesure et l'affichage (src/components/editorial/prose-view.ts).
// ---------------------------------------------------------------------------

export const ProseRunSchema = z.object({
  t: z.string(),
  /** Italique */
  i: z.boolean().optional(),
  /** Attaque en capitales espacées (premiers mots d'un chapitre) */
  sc: z.boolean().optional(),
});
export type ProseRun = z.infer<typeof ProseRunSchema>;

export const ProseItemSchema = z.object({
  kind: z.enum(["p", "quote", "subhead", "break"]),
  runs: z.array(ProseRunSchema).default([]),
  /** Retrait de première ligne */
  indent: z.boolean().optional(),
  /** Le paragraphe continue page suivante : dernière ligne justifiée */
  continues: z.boolean().optional(),
  /** Suite d'un paragraphe commencé page précédente */
  continued: z.boolean().optional(),
  /** Espace avant, en lignes de la grille */
  spaceBefore: z.number().int().min(0).max(6).optional(),
  /** Espace après, en lignes de la grille */
  spaceAfter: z.number().int().min(0).max(6).optional(),
  /** Alignement particulier (signature à droite, mention centrée) */
  align: z.enum(["right", "center"]).optional(),
  /** Nombre de lignes attendu (mesuré) : vérifié par le contrôle qualité */
  lines: z.number().int().min(0).optional(),
});
export type ProseItem = z.infer<typeof ProseItemSchema>;

export const ProseBlockSchema = z.object({
  id: z.string(),
  type: z.literal("prose"),
  items: z.array(ProseItemSchema),
  lang: z.string().default("en"),
  fontFamily: z.string(),
  fontSizePt: z.number().min(4).max(96),
  /** Interligne = pas de la ligne de base, en mm */
  leadingMm: z.number().min(1).max(40),
  indentEm: z.number().min(0).max(4).default(1),
  align: z.enum(["justify", "left", "center", "right"]).default("justify"),
  hyphenate: z.boolean().default(true),
  color: z.string().optional(),
  ...Rect,
  style: TextStyleSchema.default({}),
  editable: z.boolean().default(false),
});
export type ProseBlock = z.infer<typeof ProseBlockSchema>;

export const BlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  ListBlockSchema,
  StepBlockSchema,
  ImageBlockSchema,
  BadgeBlockSchema,
  ShapeBlockSchema,
  TocBlockSchema,
  ProseBlockSchema,
]);
export type Block = z.infer<typeof BlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type StepBlock = z.infer<typeof StepBlockSchema>;

export const PageLayoutSchema = z.object({
  widthMm: z.number(),
  heightMm: z.number(),
  background: z.string().optional(),
  showPageNumber: z.boolean().default(true),
  blocks: z.array(BlockSchema),
  /** Pages du moteur éditorial uniquement (absent pour les pages existantes). */
  editorial: z
    .object({
      template: z.string(),
      /** Numéro de page imprimé (folio) dans la pagination continue du livre */
      folio: z.number().int().optional(),
      side: z.enum(["recto", "verso"]).optional(),
      lang: z.string().optional(),
      /** Page laissée blanche volontairement (saut de chapitre sur page impaire) */
      intentionalBlank: z.boolean().optional(),
      /** Gabarit aéré par nature (couverture, dédicace…) : pas d'alerte « grand vide » */
      sparse: z.boolean().optional(),
      /** Dernière page d'un chapitre (page courte admise) */
      chapterEnd: z.boolean().optional(),
      chapter: z.number().int().optional(),
      /** Zone de sécurité (marges du gabarit) en mm */
      safe: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }).optional(),
    })
    .optional(),
});
export type PageLayout = z.infer<typeof PageLayoutSchema>;

export const PAGE_TEMPLATES = [
  { key: "cover", name: "Couverture", description: "Première de couverture avec illustration principale" },
  { key: "back_cover", name: "Quatrième de couverture", description: "Résumé, points forts, tranche d'âge" },
  { key: "intro", name: "Présentation du livre", description: "Page de bienvenue et introduction" },
  { key: "toc", name: "Sommaire", description: "Liste numérotée des activités avec pages" },
  { key: "activity_intro", name: "Présentation d'activité", description: "Titre, illustration finale, badges, description" },
  { key: "materials", name: "Liste du matériel", description: "Matériel nécessaire et consignes de sécurité" },
  { key: "steps", name: "Instructions illustrées", description: "Étapes numérotées avec illustrations" },
  { key: "science", name: "Explication pédagogique", description: "Pourquoi ça marche + mots-clés" },
  { key: "challenge", name: "Défi supplémentaire", description: "Prolongement de l'activité" },
  { key: "diploma", name: "Diplôme", description: "Diplôme de petit inventeur à compléter" },
  { key: "conclusion", name: "Page de conclusion", description: "Mot de fin et remerciements" },
  { key: "blank", name: "Page vierge", description: "Page libre" },
] as const;
export type PageTemplateKey = (typeof PAGE_TEMPLATES)[number]["key"];
