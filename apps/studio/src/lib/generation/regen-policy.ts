/**
 * Règle « pas de regénération implicite » : relancer un pipeline ne paie jamais deux fois
 * la même image. Seules les images absentes, échouées, refusées ou de démonstration (quand
 * un vrai fournisseur est configuré) sont (re)générées. Une regénération volontaire passe par
 * l'action « Regénérer » d'une image, avec estimation du coût et confirmation.
 */
export interface CurrentImageState {
  status: string;
  isDemo: boolean;
  provider?: string | null;
}

export function needsGeneration(current: CurrentImageState | null | undefined, opts: { realProvider: boolean }): boolean {
  if (!current) return true;
  if (current.status === "GENERATING") return false; // déjà en cours
  if (current.status === "ACCEPTED") return current.isDemo && opts.realProvider;
  if (current.status === "GENERATED") {
    if (current.provider === "manual") return false; // image collée, en attente de validation
    return current.isDemo && opts.realProvider;
  }
  // PENDING, FAILED, REJECTED
  return true;
}
