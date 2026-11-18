import type { BookPlan } from "@/lib/unwritten/book-plan";
import type { Dictionary } from "@/lib/unwritten/i18n/en";

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export function planPages(p: { pagesMin: number; pagesMax: number }, dict: Dictionary["plan"]) {
  return p.pagesMin === p.pagesMax ? fill(dict.pagesFixed, { count: p.pagesMin }) : fill(dict.pages, { min: p.pagesMin, max: p.pagesMax });
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 20 20" className="inline-block h-[0.95em] w-[0.95em] -translate-y-px" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1" />
      <circle cx="10" cy="10" r="3" />
      <path d="M7 4.5 8 3h4l1 1.5" />
    </svg>
  );
}

/**
 * Plan d'un livre, chapitre par chapitre.
 *  - `product` : fiche produit (ce que contient le livre) ;
 *  - `live` : à côté du questionnaire (avancement, réponses et photos déjà données) ;
 *  - `review` : récapitulatif avant paiement (plan personnalisé).
 */
export function BookPlanView({ plan, dict, variant }: { plan: BookPlan; dict: Dictionary["plan"]; variant: "product" | "live" | "review" }) {
  const compact = variant === "live";
  const showProgress = variant !== "product";
  return (
    <div>
      <div className={`flex flex-wrap items-baseline gap-x-6 gap-y-1 ${compact ? "" : "border-b border-[var(--uw-line)] pb-5"}`}>
        <span className={compact ? "uw-serif text-[1.15rem]" : "uw-serif text-[1.6rem] leading-none"}>{planPages(plan, dict)}</span>
        {plan.photosMax > 0 && (
          <span className="uw-small">
            <PhotoIcon /> {showProgress ? fill(dict.totalPhotosAdded, { added: plan.photosAdded, max: plan.photosMax }) : fill(dict.totalPhotos, { count: plan.photosMax })}
          </span>
        )}
      </div>
      <ol className={compact ? "mt-4 space-y-3" : "divide-y divide-[var(--uw-line)]"}>
        {plan.chapters.map((c) => {
          const done = showProgress && c.sources > 0 && c.answered === c.sources;
          return (
            <li key={c.key} className={compact ? "" : "grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:gap-8"}>
              <div>
                {(c.number || (showProgress && c.sources > 0)) && (
                  <p className="uw-eyebrow !text-[0.6rem]">
                    {c.number ? fill(dict.chapter, { n: c.number }) : null}
                    {showProgress && c.sources > 0 && <span className={`${c.number ? "ml-2" : ""} normal-case tracking-normal ${done ? "text-[var(--uw-ink)]" : ""}`}>{done ? "✓ " : ""}{fill(dict.fed, { answered: c.answered, total: c.sources })}</span>}
                  </p>
                )}
                <p className={compact ? "uw-serif mt-0.5 text-[1.02rem] leading-snug" : "uw-serif mt-1 text-[1.3rem] leading-snug"}>{c.title}</p>
                {!compact && <p className="uw-small mt-1.5 max-w-[46ch] !leading-relaxed">{c.what}</p>}
                {showProgress && c.highlights.length > 0 && <p className="mt-1 text-[0.82rem] italic text-[var(--uw-soft)]">{c.highlights.join(" · ")}</p>}
              </div>
              <div className={compact ? "mt-0.5 text-[0.78rem] text-[var(--uw-muted)]" : "uw-small sm:text-right"}>
                <span className="whitespace-nowrap">{planPages(c, dict)}</span>
                {c.photosMax > 0 && (
                  <span className={`whitespace-nowrap ${compact ? "ml-3" : "block sm:mt-1"}`}>
                    <PhotoIcon /> {showProgress ? fill(dict.photosAdded, { added: c.photosAdded, max: c.photosMax }) : fill(dict.photosMax, { count: c.photosMax })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
