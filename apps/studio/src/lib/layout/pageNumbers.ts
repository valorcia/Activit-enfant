import type { PageLayout } from "../schemas/layout";

/** Numérotation : les pages non numérotées (couverture…) ne comptent pas. */
export function numberPages<T extends { layout: unknown }>(pages: T[]): (number | undefined)[] {
  let n = 0;
  return pages.map((p) => {
    const l = p.layout as PageLayout;
    if (!l.showPageNumber) return undefined;
    n += 1;
    return n;
  });
}
