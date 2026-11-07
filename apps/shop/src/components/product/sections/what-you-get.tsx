import { Check, FileText } from "lucide-react";
import { parseKitContents, type ProductPageData } from "@/lib/catalog";
import { formatPlayers, formatAgeRange, formatDuration } from "@/lib/utils";

/**
 * « Ce que vous recevez » : rappel court et concret du contenu, juste sous le hero,
 * pour lever immédiatement le doute « qu'est-ce que j'achète ? ».
 * N'affiche que les données enregistrées (kit, fichiers, infos pratiques).
 */
export function WhatYouGet({ product }: { product: ProductPageData }) {
  const items = parseKitContents(product.kitContents);
  const files = product.files;
  if (items.length === 0 && files.length === 0) return null;

  const facts = [
    product.ageMin || product.ageMax ? formatAgeRange(product.ageMin, product.ageMax) : null,
    product.playersMin || product.playersMax ? formatPlayers(product.playersMin, product.playersMax) : null,
    product.durationMinutes ? `≈ ${formatDuration(product.durationMinutes)} de jeu` : null,
    product.pageCount ? `${product.pageCount} pages` : null,
  ].filter((f): f is string => !!f);

  return (
    <section className="py-8 sm:py-10" aria-labelledby="what-you-get-title">
      <div className="container-shell">
        <div className="card-soft grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 id="what-you-get-title" className="font-heading text-2xl font-bold sm:text-3xl">Ce que vous recevez</h2>
            <p className="mt-1 text-sm text-ink-soft">Tout est inclus dans votre téléchargement, prêt à imprimer.</p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[15px]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sage text-ink"><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>
                  <span className="font-semibold">{it.title}{it.quantity ? <span className="text-ink-soft font-normal"> × {it.quantity}</span> : null}</span>
                </li>
              ))}
              {items.length === 0 && files.map((f) => (
                <li key={f.id} className="flex items-start gap-2.5 text-[15px]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sage text-ink"><FileText className="size-3.5" aria-hidden /></span>
                  <span className="font-semibold">{f.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-3xl bg-cream p-4 text-sm">
            <div className="col-span-2 flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <dt className="font-bold">Format</dt>
              <dd className="text-ink-soft">{product.fileFormat} · téléchargement immédiat</dd>
            </div>
            {facts.map((f) => (
              <div key={f} className="rounded-2xl bg-white px-4 py-3 text-center font-semibold">{f}</div>
            ))}
            {files.length > 0 && (
              <div className="col-span-2 text-center text-xs text-ink-muted">{files.length} fichier{files.length > 1 ? "s" : ""} inclus · imprimable autant de fois que vous voulez</div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
