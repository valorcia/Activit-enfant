import Image from "next/image";
import { Markdown } from "@/components/markdown";
import { Reveal } from "@/components/storefront/motion";
import type { ProductPageData } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { TEMPLATE_THEMES } from "../theme";

/** Présentation immersive : histoire + illustrations en alternance. */
export function ProductStory({ product, title }: { product: ProductPageData; title?: string }) {
  if (!product.story) return null;
  const theme = TEMPLATE_THEMES[product.template];
  const illustrations = product.images.filter((i) => i.role === "ILLUSTRATION");
  // Découpe en paragraphes pour alterner texte / illustrations
  const blocks = product.story.split(/\n{2,}/).filter((b) => b.trim());
  const perBlock = illustrations.length ? Math.max(1, Math.ceil(blocks.length / illustrations.length)) : blocks.length;
  const groups: string[][] = [];
  for (let i = 0; i < blocks.length; i += perBlock) groups.push(blocks.slice(i, i + perBlock));

  return (
    <section className={cn("relative py-14 sm:py-20", theme.storyBg)} aria-labelledby="story-title">
      <div aria-hidden className="pointer-events-none absolute right-6 top-6 size-24 rounded-full bg-white/50" />
      <div className="container-shell">
        <h2 id="story-title" className="font-heading text-3xl font-bold sm:text-4xl">{title ?? theme.storyTitle}</h2>
        <div className="mt-8 space-y-10">
          {groups.map((g, i) => {
            const img = illustrations[i];
            return (
              <Reveal key={i} className={cn("grid items-center gap-8", img && "lg:grid-cols-2")}>
                <Markdown content={g.join("\n\n")} className={cn("text-lg", i % 2 === 1 && img && "lg:order-2")} />
                {img && (
                  <div className={cn("relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] shadow-soft", i % 2 === 1 && "lg:order-1")}>
                    <Image src={img.url} alt={img.alt ?? ""} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                  </div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
