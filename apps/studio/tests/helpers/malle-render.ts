/**
 * Rendu HTML statique (react-dom/server) des pages de référence La Malle à Jeux par le
 * vrai composant PageRenderer : sert à vérifier que les extensions du rendu (moteur
 * éditorial UNWRITTEN) ne changent pas un octet du HTML des pages existantes.
 *
 * `tests/fixtures/malle-render.golden.json` a été produit AVANT ces extensions
 * (commande : `npx tsx tests/helpers/malle-render.ts --write-render`).
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PageRenderer } from "@/components/page-renderer";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import type { PageLayout } from "@/lib/schemas/layout";
import { buildMalleReferencePages } from "./malle-reference";

export function renderMalleReference(): Record<string, string[]> {
  const pagesByKey = buildMalleReferencePages() as Record<string, { layout: PageLayout }[]>;
  const out: Record<string, string[]> = {};
  for (const [key, pages] of Object.entries(pagesByKey)) {
    const theme = BUILTIN_TEMPLATES.find((t) => t.key === (key.endsWith("/activity") ? "atelier" : "malle"))!.theme;
    out[key] = pages.map((p, i) => {
      const html = renderToStaticMarkup(createElement(PageRenderer, { layout: p.layout, theme, mode: "print", pageIndex: i, pageNumber: i + 1 }));
      return createHash("sha256").update(html).digest("hex");
    });
  }
  return out;
}

if (process.argv.includes("--write-render")) {
  const file = path.resolve(__dirname, "../fixtures/malle-render.golden.json");
  writeFileSync(file, JSON.stringify(renderMalleReference(), null, 1));
  console.log(`Référence écrite : ${file}`);
}
