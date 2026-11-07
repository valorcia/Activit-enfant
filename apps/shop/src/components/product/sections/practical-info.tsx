import { Users, Clock, Gauge, FileText, Scissors, Baby, FileDown } from "lucide-react";
import type { ProductPageData } from "@/lib/catalog";
import { difficultyLabel, formatAgeRange, formatDuration, formatPlayers } from "@/lib/utils";

/** Informations pratiques : uniquement les champs renseignés. */
export function PracticalInfo({ product }: { product: ProductPageData }) {
  const cards: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }> = [];
  if (product.ageMin || product.ageMax) cards.push({ icon: Baby, label: "Âge conseillé", value: formatAgeRange(product.ageMin, product.ageMax) });
  if (product.playersMin || product.playersMax) cards.push({ icon: Users, label: "Nombre de joueurs", value: formatPlayers(product.playersMin, product.playersMax) });
  if (product.durationMinutes) cards.push({ icon: Clock, label: "Durée", value: formatDuration(product.durationMinutes) });
  if (product.difficulty) {
    cards.push({
      icon: Gauge, label: "Difficulté",
      value: (
        <span className="flex flex-col gap-1">
          <span>{difficultyLabel(product.difficulty)}</span>
          <span className="flex gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2 w-5 rounded-full ${n <= (product.difficulty ?? 0) ? "bg-coral" : "bg-ink/10"}`} />)}</span>
        </span>
      ),
    });
  }
  if (product.pageCount) cards.push({ icon: FileText, label: "Nombre de pages", value: `${product.pageCount} pages` });
  cards.push({ icon: FileDown, label: "Format", value: `${product.fileFormat} à télécharger` });
  if (product.materials.length) cards.push({ icon: Scissors, label: "Matériel nécessaire", value: product.materials.join(", ") });

  return (
    <section className="py-14 sm:py-20" aria-labelledby="infos-title">
      <div className="container-shell">
        <h2 id="infos-title" className="font-heading text-3xl font-bold sm:text-4xl">Informations pratiques</h2>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="card-soft flex gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cream"><c.icon className="size-5 text-coral-dark" /></span>
              <div className="min-w-0">
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{c.label}</dt>
                <dd className="mt-0.5 font-heading text-base font-semibold">{c.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
