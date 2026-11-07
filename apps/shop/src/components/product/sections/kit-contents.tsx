import { FileText } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/storefront/motion";
import { parseKitContents, type ProductPageData } from "@/lib/catalog";
import { formatBytes } from "@/lib/utils";
import { TEMPLATE_THEMES } from "../theme";

const FILE_KIND_LABELS: Record<string, string> = { MAIN_PDF: "Kit principal", EXTRA_PDF: "Complément", INSTRUCTIONS: "Instructions", BONUS: "Bonus" };
const TINTS = ["bg-sky-light", "bg-honey-light", "bg-sage-light", "bg-lavender-light", "bg-coral-light"];

/** Contenu du kit : uniquement ce qui est enregistré en base. Aucun lien vers les fichiers payants. */
export function KitContents({ product, title }: { product: ProductPageData; title?: string }) {
  const items = parseKitContents(product.kitContents);
  const files = product.files;
  if (items.length === 0 && files.length === 0) return null;
  const theme = TEMPLATE_THEMES[product.template];

  return (
    <section className="py-14 sm:py-20" aria-labelledby="kit-title">
      <div className="container-shell">
        <h2 id="kit-title" className="font-heading text-3xl font-bold sm:text-4xl">{title ?? theme.kitTitle}</h2>
        {items.length > 0 && (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <Reveal as="li" key={i} delay={i * 0.05} className="card-soft card-hover flex gap-4 p-5">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${TINTS[i % TINTS.length]}`}><Icon name={it.icon ?? "file-text"} className="size-6" /></span>
                <div>
                  <p className="font-heading text-lg font-semibold leading-tight">
                    {it.title}{it.quantity ? <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-bold text-ink-soft">× {it.quantity}</span> : null}
                  </p>
                  {it.description && <p className="mt-1 text-sm text-ink-soft">{it.description}</p>}
                </div>
              </Reveal>
            ))}
          </ul>
        )}
        {files.length > 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-ink/20 bg-white/60 p-5">
            <p className="font-heading font-bold">Fichiers inclus dans votre téléchargement</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 text-sm">
                  <FileText className="size-4 shrink-0 text-coral-dark" aria-hidden />
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-ink-muted">· {FILE_KIND_LABELS[f.kind] ?? f.kind}{f.sizeBytes ? ` · ${formatBytes(f.sizeBytes)}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">Les fichiers sont envoyés par email et accessibles immédiatement après le paiement.</p>
          </div>
        )}
      </div>
    </section>
  );
}
