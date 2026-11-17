import { z } from "zod";

/**
 * Réglages propres à une marque personnalisée, stockés dans `Site.settings.unwritten`
 * (clé ignorée par les réglages de La Malle à Jeux : aucun effet sur l'existant).
 */
export const unwrittenConfigSchema = z.object({
  /** Conservation d'un brouillon sans activité (expiration glissante à chaque sauvegarde). */
  draftRetentionDays: z.number().int().min(1).max(365).default(30),
  /** Validité d'un lien magique de reprise. */
  resumeLinkValidityHours: z.number().int().min(1).max(24 * 30).default(72),
  /** Conservation des réponses après livraison (ensuite effacées de la commande). */
  deliveredDataRetentionDays: z.number().int().min(7).max(730).default(90),
  /** Validité du lien envoyé au destinataire d'un cadeau. */
  giftLinkValidityDays: z.number().int().min(1).max(365).default(60),
  /** Nombre de téléchargements autorisés pour un livre livré. */
  maxDownloads: z.number().int().min(1).max(100).default(10),
  /** Adresse de contact affichée dans la vitrine et les e-mails (facultative). */
  contactEmail: z.string().max(120).nullable().default(null),
  /** Préfixe des numéros de commande de la marque. */
  orderPrefix: z.string().regex(/^[A-Z]{1,6}$/).default("UW"),
});
export type UnwrittenConfig = z.infer<typeof unwrittenConfigSchema>;

export function readUnwrittenConfig(settings: unknown): UnwrittenConfig {
  const raw = settings && typeof settings === "object" ? (settings as Record<string, unknown>).unwritten : undefined;
  const parsed = unwrittenConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : unwrittenConfigSchema.parse({});
}
