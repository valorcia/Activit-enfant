/**
 * Pagination d'un flux de texte déjà mesuré (nombre de lignes réel de chaque paragraphe).
 * Fonction pure : aucune dépendance au navigateur, testée unitairement.
 *
 * Règles :
 *  - grille de lignes : une page contient `capacity` lignes (moins en ouverture de chapitre
 *    ou sous une illustration) ;
 *  - orphelines : au moins `minOrphan` lignes d'un paragraphe en bas de page ;
 *  - veuves : au moins `minWidow` lignes d'un paragraphe en haut de page ;
 *  - intertitres et ornements jamais seuls en bas de page (suivis d'au moins 2 lignes) ;
 *  - l'espace avant un élément disparaît en haut de page ;
 *  - éléments flottants : une illustration « figure » ouvre la page suivante (texte dessous),
 *    les éléments pleine page (citation, activité, souvenir, illustration pleine page) sont
 *    insérés à la prochaine fin de page ; ceux qui ne doivent pas couper une phrase attendent
 *    une fin de page tombant entre deux paragraphes.
 */

export interface FlowUnit<F = unknown> {
  kind: "p" | "quote" | "subhead" | "break" | "float";
  /** Lignes mesurées (0 pour un flottant) */
  lines: number;
  /** Espace avant, en lignes */
  spaceBefore?: number;
  float?: F;
}

export interface PageFragment {
  /** Index de l'unité dans le flux */
  unit: number;
  /** Lignes [from, to) de l'unité */
  from: number;
  to: number;
  /** Espace avant effectivement appliqué (0 en haut de page) */
  spaceBefore: number;
}

export interface FlowPage<F = unknown> {
  fragments: PageFragment[];
  used: number;
  capacity: number;
  /** Illustration placée en tête de cette page */
  figure?: F;
  /** Pages pleines insérées après cette page */
  floatsAfter: F[];
}

export interface PaginateOptions<F> {
  /** Lignes disponibles sur la page `index` du flux (0 = ouverture), avec ou sans illustration en tête */
  capacity: (index: number, figure: F | undefined) => number;
  /** L'élément flottant se place-t-il en tête de page (figure) plutôt que sur une page à part ? */
  isFigure?: (f: F) => boolean;
  /** L'élément pleine page peut-il interrompre un paragraphe (illustration) ? */
  canSplitParagraph?: (f: F) => boolean;
  minOrphan?: number;
  minWidow?: number;
}

export function paginateFlow<F>(units: FlowUnit<F>[], opts: PaginateOptions<F>): FlowPage<F>[] {
  const minOrphan = opts.minOrphan ?? 2;
  const minWidow = opts.minWidow ?? 2;
  const isFigure = opts.isFigure ?? (() => false);
  const canSplit = opts.canSplitParagraph ?? (() => false);
  const pages: FlowPage<F>[] = [];
  const pendingFigures: F[] = [];
  const pendingPages: F[] = [];
  let cur: FlowPage<F> | null = null;

  const open = (): FlowPage<F> => {
    const figure = pendingFigures.shift();
    cur = { fragments: [], used: 0, capacity: Math.max(1, opts.capacity(pages.length, figure)), figure, floatsAfter: [] };
    pages.push(cur);
    return cur;
  };
  /** Ferme la page ; `midParagraph` : la coupure tombe à l'intérieur d'un paragraphe. */
  const close = (midParagraph: boolean) => {
    if (!cur) return;
    const keep: F[] = [];
    for (const f of pendingPages.splice(0)) (midParagraph && !canSplit(f) ? keep : cur.floatsAfter).push(f);
    pendingPages.push(...keep);
    cur = null;
  };
  const page = () => cur ?? open();
  const nextText = (i: number) => units.slice(i + 1).find((u) => u.kind !== "float");

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.kind === "float") {
      if (u.float !== undefined) (isFigure(u.float) ? pendingFigures : pendingPages).push(u.float);
      continue;
    }
    if (u.kind === "subhead" || u.kind === "break") {
      let p = page();
      let sb = p.used === 0 ? 0 : (u.spaceBefore ?? 0);
      const next = nextText(i);
      const follow = next ? Math.min(minOrphan, next.lines) + (next.spaceBefore ?? 0) : 0;
      if (p.used > 0 && p.used + sb + u.lines + follow > p.capacity) {
        close(false);
        p = open();
        sb = 0;
      }
      p.fragments.push({ unit: i, from: 0, to: u.lines, spaceBefore: sb });
      p.used += sb + u.lines;
      continue;
    }
    // Paragraphe ou citation dans le texte : sécable, sous contrainte veuves / orphelines
    let from = 0;
    const n = u.lines;
    let guard = 0;
    while (from < n) {
      if (++guard > 10_000) throw new Error("Pagination : boucle infinie");
      const p = page();
      const sb = p.used === 0 || from > 0 ? 0 : (u.spaceBefore ?? 0);
      const room = p.capacity - p.used - sb;
      const rest = n - from;
      if (rest <= room) {
        p.fragments.push({ unit: i, from, to: n, spaceBefore: sb });
        p.used += sb + rest;
        from = n;
        break;
      }
      let a = room;
      if (rest - a < minWidow) a = rest - minWidow;
      if (from === 0 && a < minOrphan) a = 0;
      if (a <= 0) {
        if (p.used === 0) {
          // Page trop petite pour respecter les règles : on remplit quand même (signalé par le contrôle qualité)
          a = Math.min(rest, Math.max(1, room));
        } else {
          close(false);
          continue;
        }
      }
      p.fragments.push({ unit: i, from, to: from + a, spaceBefore: sb });
      p.used += sb + a;
      from += a;
      close(from < n);
    }
  }
  if (cur) close(false);
  if (pages.length === 0) {
    open();
    close(false);
  }
  const last = pages[pages.length - 1];
  // Ce qui reste en attente (illustrations finales) suit la dernière page
  last.floatsAfter.push(...pendingFigures.splice(0), ...pendingPages.splice(0));
  return pages;
}

/** Lignes manquantes sur les pages pleines (pages courtes dues aux veuves et orphelines). */
export function shortPages<F>(pages: FlowPage<F>[]): { index: number; missing: number }[] {
  return pages.slice(0, -1).map((p, index) => ({ index, missing: p.capacity - p.used })).filter((x) => x.missing > 0);
}
