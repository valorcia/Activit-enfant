import { z } from "zod";

export const AiSettingsSchema = z.object({
  /** api : appels aux API (clés requises) · manual : copier-coller des prompts dans Claude / ChatGPT, sans clé */
  mode: z.enum(["api", "manual"]).default("api"),
  /** Périmètre du mode copier-coller : tout, ou seulement les images (ex. clé Claude pour le texte, ChatGPT pour les images) */
  manualFor: z.enum(["all", "images", "text"]).default("all"),
  textProvider: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  textModel: z.string().default("claude-opus-5-5"),
  imageProvider: z.enum(["openai", "mock"]).default("mock"),
  imageModel: z.string().default("gpt-image-1"),
  imageQuality: z.enum(["low", "medium", "high"]).default("medium"),
  imageSize: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
  /** Mode esquisse : illustrations d'abord en qualité basse (≈ 0,01 $), version finale après validation de l'aperçu */
  sketchMode: z.boolean().default(false),
  sketchQuality: z.enum(["low", "medium"]).default("low"),
  stepIllustrations: z.boolean().default(true),
  /** Illustrations d'étapes par activité (livres d'activités) — borne haute technique, pas éditoriale */
  maxStepIllustrations: z.number().int().min(0).max(60).default(8),
  maxBudgetPerBookUsd: z.number().min(0).default(50),
  maxConcurrentGenerations: z.number().int().min(1).max(10).default(2),
  language: z.string().default("fr"),
  /**
   * Réglages d'image propres au cahier de coloriage (mode API) : un dessin au trait n'a pas
   * besoin du modèle le plus cher, et une esquisse coûterait presque autant qu'un dessin final.
   * La couverture, en couleur, garde un modèle et une qualité supérieurs.
   */
  coloring: z
    .object({
      imageModel: z.string().default("gpt-image-1-mini"),
      imageQuality: z.enum(["low", "medium", "high"]).default("medium"),
      sketch: z.boolean().default(false),
      coverModel: z.string().default("gpt-image-1"),
      coverQuality: z.enum(["low", "medium", "high"]).default("high"),
    })
    .default({}),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export const DEFAULT_AI_SETTINGS: AiSettings = AiSettingsSchema.parse({});

// ---------------------------------------------------------------------------
// Boutique (apps/shop) — publication automatique des e-books
// ---------------------------------------------------------------------------

export const SHOP_TEMPLATES = ["ADVENTURE", "ACTIVITY", "STORY", "EVENT", "CLASSIC", "GUIDE", "RECIPES"] as const;

export const ShopSettingsSchema = z.object({
  shopApiUrl: z.string().default(""),           // ex. https://activite-enfant-shop.vercel.app
  shopApiKey: z.string().default(""),           // stockée côté serveur uniquement, jamais renvoyée en clair
  autoPublish: z.boolean().default(true),       // publier immédiatement (sinon brouillon « à valider » dans la boutique)
  defaultPriceCents: z.number().int().min(0).default(990),
  defaultCategorySlug: z.string().default("histoires-et-aventures"),
  defaultTemplate: z.enum(SHOP_TEMPLATES).default("STORY"),
});
export type ShopSettings = z.infer<typeof ShopSettingsSchema>;
export const DEFAULT_SHOP_SETTINGS: ShopSettings = ShopSettingsSchema.parse({});

/** Fiche commerciale éditable d'un livre (stockée dans Book.shopListing, fusionnée avec les valeurs dérivées du livre). */
export const ShopListingSchema = z.object({
  name: z.string().max(160).optional(),
  slug: z.string().max(96).optional(),
  tagline: z.string().max(200).optional(),
  shortDescription: z.string().max(400).optional(),
  longDescription: z.string().max(20000).optional(),
  story: z.string().max(20000).optional(),
  priceCents: z.number().int().min(0).optional(),
  salePriceCents: z.number().int().min(0).nullable().optional(),
  categorySlug: z.string().optional(),
  collectionSlugs: z.array(z.string()).optional(),
  template: z.enum(SHOP_TEMPLATES).optional(),
  universe: z.string().max(80).optional(),
  tags: z.array(z.string()).optional(),
  ageMin: z.number().int().min(0).optional(),
  ageMax: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  kitContents: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional(), quantity: z.number().int().optional() })).optional(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  sellingPoints: z.array(z.object({ title: z.string(), description: z.string().optional(), icon: z.string().optional() })).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(170).optional(),
  keywords: z.array(z.string()).optional(),
  autoPublish: z.boolean().optional(), // surcharge du réglage global pour ce livre
});
export type ShopListing = z.infer<typeof ShopListingSchema>;

// ---------------------------------------------------------------------------
// Studio : nom affiché, prix par défaut par type de kit, charte d'illustration
// ---------------------------------------------------------------------------

export const DEFAULT_ILLUSTRATION_CHARTER =
  "Style : illustration jeunesse à l'aquarelle, contours fins et doux, couleurs chaudes et lumineuses (crème #FFF9F0, corail, jaune miel, vert sauge, bleu ciel), grain de papier léger, lumière douce, aucune ombre dure. Personnages expressifs, visages ronds et souriants, proportions enfantines (grosse tête, grands yeux), aucun texte dans l'image sauf demande explicite. Cadrage lisible pour une impression A4, marges propres, fond uni crème ou décor simple. Pas de style 3D, pas de photo-réalisme, pas de logo.";

export const StudioSettingsSchema = z.object({
  studioName: z.string().min(1).max(80).default("La Malle à Jeux · Studio"),
  defaultAuthor: z.string().max(80).default("La Malle à Jeux"),
  /** Charte « kit enfants » historique (conservée pour compatibilité ; voir illustrationCharters) */
  illustrationCharter: z.string().max(4000).default(DEFAULT_ILLUSTRATION_CHARTER),
  /** Chartes d'illustration par préréglage d'univers (vide = charte par défaut du préréglage) */
  illustrationCharters: z.record(z.string(), z.string().max(4000)).default({}),
  /** Univers ciblé par défaut pour les nouveaux e-books (slug de la boutique) */
  defaultSiteSlug: z.string().max(120).nullable().default(null),
  /** Prix par défaut par type de kit (centimes), surcharge du référentiel */
  priceByKitType: z.record(z.string(), z.number().int().min(0)).default({}),
});
export type StudioSettings = z.infer<typeof StudioSettingsSchema>;
export const DEFAULT_STUDIO_SETTINGS: StudioSettings = StudioSettingsSchema.parse({});

// ---------------------------------------------------------------------------
// Vidéos publicitaires (Remotion + Runway)
// ---------------------------------------------------------------------------

export const VideoSettingsSchema = z.object({
  runwayApiKey: z.string().default(""), // stockée côté serveur uniquement, jamais renvoyée en clair (repli : RUNWAY_API_KEY)
  /** Coût Runway estimé en $ par seconde de clip (Gen-4 Turbo ≈ 5 crédits/s × 0,01 $) */
  usdPerSecond: z.number().min(0).max(5).default(0.05),
  defaultDurationSeconds: z.number().int().min(6).max(20).default(15),
  defaultMusicAssetId: z.string().nullable().default(null),
  musicVolume: z.number().min(0).max(1).default(0.6),
});
export type VideoSettings = z.infer<typeof VideoSettingsSchema>;
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = VideoSettingsSchema.parse({});

// ---------------------------------------------------------------------------
// Pilote automatique (brief → kit → PDF → boutique → vidéo → publicités)
// ---------------------------------------------------------------------------

export const AUTOPILOT_STAGE_KEYS = ["plan", "content", "quality", "character", "illustrations", "layout", "pdf", "publish", "etsy", "video", "ads"] as const;
export type AutopilotStageKey = (typeof AUTOPILOT_STAGE_KEYS)[number];

export const AutopilotSettingsSchema = z.object({
  /** Étapes facultatives (les étapes de production — plan, contenu, illustrations, pages — sont toujours faites) */
  stages: z
    .object({
      quality: z.boolean().default(true),
      character: z.boolean().default(true),
      pdf: z.boolean().default(true),
      publish: z.boolean().default(true),
      /** « Publier aussi sur Etsy » (via la boutique, qui doit avoir une boutique Etsy connectée) */
      etsy: z.boolean().default(false),
      video: z.boolean().default(true),
      ads: z.boolean().default(true),
    })
    .default({}),
  /** Publication directe dans la boutique (sinon brouillon « à valider ») */
  publishDirect: z.boolean().default(true),
  /** État de la fiche Etsy créée : brouillon (à vérifier sur Etsy) ou active (0,20 $ facturés par Etsy) */
  etsyState: z.enum(["draft", "active"]).default("draft"),
  /** Export imprimable en plus de la version numérique */
  printPdf: z.boolean().default(false),
  videoFormats: z.array(z.enum(["story", "square", "landscape"])).min(1).default(["story", "square"]),
  videoDurationSeconds: z.number().int().min(6).max(20).default(15),
  /** Clip d'accroche : aucun, Runway, copier-coller (ou démo en développement) */
  clipProvider: z.enum(["none", "runway", "manual", "mock"]).default("none"),
  clipDurationSeconds: z.union([z.literal(5), z.literal(10)]).default(5),
  channels: z.array(z.enum(["instagram", "facebook", "tiktok"])).default(["instagram", "facebook", "tiktok"]),
  variantsPerChannel: z.number().int().min(1).max(3).default(2),
  postsMode: z.enum(["draft", "auto"]).default("draft"),
  postsStartOffsetHours: z.number().int().min(0).max(24 * 30).default(24),
  postsSpacingHours: z.number().int().min(1).max(24 * 7).default(24),
  dailyBudgetCents: z.number().int().min(0).max(1_000_000).default(1000),
  /** Points de validation humaine (le run s'arrête et attend « Valider et continuer ») */
  approvals: z
    .object({
      afterContent: z.boolean().default(false),
      afterIllustrations: z.boolean().default(false),
      beforePublish: z.boolean().default(false),
      /** null = automatique : validation seulement si les posts sont programmés automatiquement */
      beforeAds: z.boolean().nullable().default(null),
    })
    .default({}),
  maxCostUsd: z.number().min(0).max(500).default(10),
  /** Esquisses d'abord (qualité basse) puis version finale des images validées : évite de payer plusieurs fois la qualité finale */
  sketchFirst: z.boolean().default(true),
  /** Point de validation des esquisses (aperçu) avant la version finale ; sinon la version finale est lancée directement */
  sketchApproval: z.boolean().default(true),
});
export type AutopilotSettings = z.infer<typeof AutopilotSettingsSchema>;
export const DEFAULT_AUTOPILOT_SETTINGS: AutopilotSettings = AutopilotSettingsSchema.parse({});
