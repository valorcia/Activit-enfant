import type { AiSettings } from "../schemas/settings";

/**
 * Faut-il produire une esquisse ? Demande explicite, sinon réglage « mode esquisse ».
 * Jamais en copier-coller (l'image est faite dans ChatGPT, sans coût par image) ni avec
 * le fournisseur de démonstration… sauf demande explicite (tests, démonstrations du flux).
 */
export function useSketch(settings: Pick<AiSettings, "sketchMode">, providerName: string, requested?: boolean): boolean {
  if (providerName === "manual") return false;
  if (requested !== undefined) return requested;
  if (providerName === "mock") return false;
  return settings.sketchMode;
}
