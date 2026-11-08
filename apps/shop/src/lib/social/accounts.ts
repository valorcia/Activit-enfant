/**
 * Comptes sociaux utilisables pour un produit : ceux de l'audience de son univers
 * en priorité, puis ceux qui ne sont rattachés à aucune audience (comptes communs).
 * Les comptes d'une autre audience sont exclus : on ne publie jamais un guide
 * piscine sur la page Facebook « familles ».
 */
export function accountsForAudience<T extends { audienceId: string | null }>(accounts: T[], audienceId: string | null | undefined): T[] {
  const own = audienceId ? accounts.filter((a) => a.audienceId === audienceId) : [];
  const shared = accounts.filter((a) => a.audienceId == null);
  return [...own, ...shared];
}
