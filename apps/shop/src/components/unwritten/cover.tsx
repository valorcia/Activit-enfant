import type { Locale } from "@/lib/unwritten/constants";

/**
 * Couvertures typographiques des trois collections (aucune image, aucun dégradé) :
 * elles évoquent l'objet livre sans prétendre montrer un livre réel de client.
 * Les vraies couvertures viendront du moteur éditorial du studio.
 */
const SUB: Record<string, Record<Locale, string>> = {
  "secret-book": { en: "to open together", fr: "à ouvrir ensemble" },
  "before-its-too-late": { en: "while there is still time", fr: "tant qu'il est temps" },
  "movie-of-my-life": { en: "a life in scenes", fr: "une vie en scènes" },
};
const FOR: Record<Locale, string> = { en: "Written for", fr: "Écrit pour" };

export function BookCover({ collectionKey, title, locale, className = "", priority = false }: { collectionKey: string; title: string; locale: Locale; className?: string; priority?: boolean }) {
  const words = title.split(/\s+/);
  const sub = SUB[collectionKey]?.[locale] ?? "";
  const label = `${title}${sub ? ` — ${sub}` : ""}`;

  if (collectionKey === "movie-of-my-life") {
    return (
      <div className={`uw-cover ${className}`} style={{ background: "#A7A39B", color: "#171717" }} role="img" aria-label={label} data-priority={priority || undefined}>
        <div className="absolute inset-x-0 top-0" style={{ height: "13%", background: "#171717" }} />
        <div className="absolute inset-x-0 bottom-0 flex items-center" style={{ height: "13%", background: "#171717", paddingLeft: "12cqw", color: "rgb(247 244 238 / .7)" }}>
          <span className="uw-cover-for">{FOR[locale]} ———</span>
        </div>
        <div className="uw-cover-inner" style={{ paddingTop: "21cqw" }}>
          <span className="uw-cover-mark" style={{ color: "#171717" }}>UNWRITTEN</span>
          <div className="mt-auto mb-[22cqw]">
            <p className="uw-cover-title" style={{ fontSize: "12.5cqw", textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.02 }}>
              {words.slice(0, 2).join(" ")}<br />{words.slice(2).join(" ")}
            </p>
            <span className="uw-cover-line mt-[6cqw]" style={{ background: "#171717" }} />
            <p className="uw-cover-sub mt-[4cqw]">{sub}</p>
          </div>
        </div>
      </div>
    );
  }

  if (collectionKey === "before-its-too-late") {
    return (
      <div className={`uw-cover uw-cover--light ${className}`} style={{ background: "#FFFFFF", color: "#171717" }} role="img" aria-label={label}>
        <div className="uw-cover-inner">
          <span className="uw-cover-mark">UNWRITTEN</span>
          <p className="uw-cover-title mt-[24cqw]" style={{ fontSize: "15cqw" }}>
            {words.map((w, i) => <span key={i} className="block">{w}</span>)}
          </p>
          <span className="uw-cover-line mt-[7cqw]" style={{ background: "#A7A39B" }} />
          <p className="uw-cover-sub mt-[4cqw]" style={{ color: "#5c5852" }}>{sub}</p>
          {/* Horizon : demi-cercle au trait */}
          <div className="mt-auto flex items-end justify-between">
            <span className="uw-cover-for" style={{ color: "#5c5852" }}>{FOR[locale]} ———</span>
            <span aria-hidden className="block" style={{ width: "20cqw", height: "10cqw", borderTopLeftRadius: "20cqw", borderTopRightRadius: "20cqw", border: "1px solid #A7A39B", borderBottom: "none" }} />
          </div>
        </div>
      </div>
    );
  }

  // The Secret Book (défaut)
  return (
    <div className={`uw-cover ${className}`} style={{ background: "#171717", color: "#F7F4EE" }} role="img" aria-label={label}>
      <div className="absolute" style={{ inset: "5.5cqw 5.5cqw 5.5cqw 7.5cqw", border: "1px solid rgb(197 167 123 / .55)" }} />
      <div className="uw-cover-inner">
        <div className="flex items-start justify-between">
          <span className="uw-cover-mark" style={{ color: "#C5A77B" }}>UNWRITTEN</span>
          <span aria-hidden className="block rounded-full" style={{ width: "11cqw", height: "11cqw", border: "1px solid #C5A77B" }} />
        </div>
        <p className="uw-cover-title uw-italic mt-[26cqw]" style={{ fontSize: "16cqw" }}>
          {words.map((w, i) => <span key={i} className="block">{w}</span>)}
        </p>
        <span className="uw-cover-line mt-[7cqw]" style={{ background: "#C5A77B" }} />
        <p className="uw-cover-sub mt-[4cqw]" style={{ color: "rgb(247 244 238 / .75)" }}>{sub}</p>
        <span className="uw-cover-for mt-auto" style={{ color: "rgb(247 244 238 / .6)" }}>{FOR[locale]} ———</span>
      </div>
    </div>
  );
}
