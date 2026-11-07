"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";
import { cn } from "@/lib/utils";

export interface GalleryMedia { id: string; url: string; alt: string | null; role: string }

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** Galerie interactive : images, mockups, aperçus PDF et vidéos. Navigation clavier + glissement tactile. */
export function ProductGallery({ media, productName, universe, title }: { media: GalleryMedia[]; productName: string; universe?: string | null; title: string }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = media.length;
  const go = useCallback((delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)), [count]);

  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  if (count === 0) {
    return (
      <section className="py-14 sm:py-20" aria-labelledby="gallery-title">
        <div className="container-shell">
          <h2 id="gallery-title" className="font-heading text-3xl font-bold sm:text-4xl">{title}</h2>
          <div className="mt-8 aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] shadow-card sm:aspect-[21/9]">
            <PlaceholderArt universe={universe} label="Aperçu à venir" />
          </div>
        </div>
      </section>
    );
  }

  const current = media[index];
  const isVideo = current.role === "VIDEO";
  const embed = isVideo ? embedUrl(current.url) : null;

  return (
    <section className="py-14 sm:py-20" aria-labelledby="gallery-title">
      <div className="container-shell">
        <h2 id="gallery-title" className="font-heading text-3xl font-bold sm:text-4xl">{title}</h2>
        <div
          className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card sm:aspect-[16/10]"
          role="region" aria-roledescription="carrousel" aria-label={`Aperçus de ${productName}`}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          {isVideo ? (
            embed ? (
              <iframe src={embed} title={current.alt ?? `Vidéo — ${productName}`} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" />
            ) : (
              <video src={current.url} controls preload="metadata" className="absolute inset-0 h-full w-full object-contain bg-ink" aria-label={current.alt ?? `Vidéo — ${productName}`} />
            )
          ) : (
            <Image key={current.id} src={current.url} alt={current.alt ?? `${productName} — aperçu ${index + 1}`} fill sizes="(max-width: 1280px) 100vw, 1200px" className="object-contain" />
          )}
          {current.role === "PDF_PREVIEW" && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink shadow-sm">Extrait du PDF</span>}
          {count > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Aperçu précédent" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-card hover:bg-white"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={() => go(1)} aria-label="Aperçu suivant" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-card hover:bg-white"><ChevronRight className="size-5" /></button>
            </>
          )}
          <p className="sr-only" aria-live="polite">Aperçu {index + 1} sur {count}</p>
        </div>

        {count > 1 && (
          <ul className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none" aria-label="Vignettes">
            {media.map((m, i) => (
              <li key={m.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Afficher l'aperçu ${i + 1}`}
                  aria-current={i === index}
                  className={cn("relative size-20 overflow-hidden rounded-2xl border-2 bg-white transition-all sm:size-24", i === index ? "border-coral shadow-card" : "border-transparent opacity-70 hover:opacity-100")}
                >
                  {m.role === "VIDEO" ? (
                    <span className="grid h-full w-full place-items-center bg-ink text-white"><Play className="size-6" /></span>
                  ) : (
                    <Image src={m.url} alt="" fill sizes="96px" className="object-cover" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
