/**
 * Ajustement automatique des textes (navigateur) : un bloc texte ou liste dont le contenu
 * déborde de son cadre réduit sa taille de police par paliers de 4 %, jusqu'à 70 % au plus.
 * Évite la retouche manuelle des débordements, à l'aperçu comme dans le PDF (même rendu).
 *
 * Le bloc porte `data-autofit` et sa taille déclarée dans `data-font` (ex. « 13.5pt ») :
 * l'ajustement repart toujours de cette taille, même après une modification dans l'éditeur.
 */
export const AUTOFIT_MIN = 0.7;
const STEP = 0.04;

/** Ajuste un élément [data-autofit] ; renvoie l'échelle appliquée (1 = inchangé). */
export function autoFitElement(el: HTMLElement): number {
  const decl = el.dataset.font;
  if (!decl) return 1;
  el.style.fontSize = decl;
  let scale = 1;
  while (el.scrollHeight > el.clientHeight + 1 && scale - STEP >= AUTOFIT_MIN - 1e-9) {
    scale = Math.round((scale - STEP) * 100) / 100;
    el.style.fontSize = `calc(${decl} * ${scale})`;
  }
  el.dataset.autofitScale = String(scale);
  return scale;
}

/** Ajuste tous les blocs d'une zone (page, livre entier) ; renvoie le nombre de blocs réduits. */
export function autoFitAll(root: ParentNode = document): number {
  let changed = 0;
  root.querySelectorAll<HTMLElement>("[data-autofit]").forEach((el) => {
    if (autoFitElement(el) < 1) changed++;
  });
  return changed;
}
