import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/storefront/motion";
import { parseSellingPoints, type ProductPageData } from "@/lib/catalog";
import type { SellingPoint } from "@/lib/schemas/product";
import { TEMPLATE_THEMES } from "../theme";

const DEFAULT_POINTS: SellingPoint[] = [
  { title: "Simplicité d'organisation", description: "Tout est prêt : imprimez, suivez le guide et lancez l'activité.", icon: "list-checks" },
  { title: "Une activité originale", description: "Un univers soigné, pensé pour captiver les enfants.", icon: "sparkles" },
  { title: "Des moments partagés", description: "À vivre en famille ou entre amis, sans écran.", icon: "heart" },
  { title: "Impression à domicile", description: "Un PDF compatible avec toutes les imprimantes.", icon: "printer" },
  { title: "Téléchargement immédiat", description: "Vos fichiers dès la confirmation du paiement.", icon: "download" },
];
const TINTS = ["bg-coral text-white", "bg-honey text-ink", "bg-sage text-ink", "bg-sky text-ink", "bg-lavender text-ink"];

export function SellingPoints({ product, title }: { product: ProductPageData; title?: string }) {
  const points = parseSellingPoints(product.sellingPoints);
  const list = points.length ? points : DEFAULT_POINTS;
  const theme = TEMPLATE_THEMES[product.template];
  return (
    <section className="bg-white py-14 sm:py-20" aria-labelledby="selling-title">
      <div className="container-shell">
        <h2 id="selling-title" className="font-heading text-3xl font-bold sm:text-4xl">{title ?? theme.sellingTitle}</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <Reveal as="li" key={i} delay={i * 0.05} className="flex gap-4">
              <span className={`grid size-12 shrink-0 place-items-center rounded-2xl shadow-card ${TINTS[i % TINTS.length]}`}><Icon name={p.icon ?? "sparkles"} className="size-6" /></span>
              <div>
                <p className="font-heading text-lg font-semibold">{p.title}</p>
                {p.description && <p className="mt-1 text-sm text-ink-soft">{p.description}</p>}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
