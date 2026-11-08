"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ShoppingBag, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart, cartCount } from "@/lib/cart/store";
import { cn, formatAgeRange, formatPrice } from "@/lib/utils";
import type { BrandSettings } from "@/lib/schemas/settings";
import { PlaceholderArt } from "./placeholder-art";

export interface LandingProduct {
  slug: string;
  name: string;
  ageMin: number | null;
  ageMax: number | null;
  universe: string | null;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  imageUrl: string | null;
  isNew: boolean;
}

/**
 * En-tête des landing pages produit : fin, translucide, sans navigation
 * complète. Un seul menu « Découvrir les autres aventures » + le panier.
 */
export function LandingHeader({ brand, products }: { brand: BrandSettings; products: LandingProduct[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const openCart = useCart((s) => s.open);
  const count = hydrated ? cartCount(items) : 0;

  const currentSlug = pathname.startsWith("/aventures/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : "";
  const others = products.filter((p) => p.slug !== currentSlug);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);
  useEffect(() => {
    // Sur mobile, le panneau est plein écran : on bloque le défilement derrière
    if (!open) return;
    const mq = window.matchMedia("(max-width: 639px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <header className={cn("sticky top-0 z-40 transition-shadow", scrolled && "shadow-soft")}>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Aller au contenu</a>
      <div className="border-b border-line/60 bg-cream/85 backdrop-blur-md">
        <div className="container-shell flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${brand.name} — accueil`}>
            {brand.logoUrl ? (
              <Image src={brand.logoUrl} alt={brand.name} width={140} height={40} className="h-8 w-auto sm:h-9" priority />
            ) : (
              <>
                <span className="grid size-8 place-items-center rounded-xl bg-[var(--landing-accent,var(--brand-coral))] text-white shadow-sm rotate-[-6deg]">
                  <Icon name="box" className="size-4" />
                </span>
                <span className="font-heading text-lg font-bold leading-none sm:text-xl">{brand.logoText ?? brand.name}</span>
              </>
            )}
          </Link>

          <div className="relative flex items-center gap-1 sm:gap-2">
            <button
              ref={triggerRef}
              type="button"
              className={cn("inline-flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-white/80 px-3 font-heading text-sm font-semibold text-ink transition-colors hover:border-ink/40 hover:bg-white sm:px-4", open && "border-ink/40 bg-white")}
              aria-expanded={open}
              aria-controls="landing-others"
              aria-haspopup="dialog"
              onClick={() => setOpen((o) => !o)}
            >
              <Sparkles className="size-4 text-[var(--landing-accent,var(--brand-coral))]" aria-hidden />
              <span className="hidden sm:inline">Découvrir les autres aventures</span>
              <span className="sm:hidden">Autres aventures</span>
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </button>

            <Button variant="ghost" size="icon" aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`} onClick={openCart} className="relative">
              <ShoppingBag className="size-5" />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{count}</span>}
            </Button>

            {open && (
              <div
                ref={panelRef}
                id="landing-others"
                role="dialog"
                aria-label="Autres aventures disponibles"
                className="fixed inset-0 z-50 flex flex-col bg-cream sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[420px] sm:max-h-[min(70dvh,640px)] sm:rounded-3xl sm:border sm:border-line sm:shadow-lift"
              >
                <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:py-3">
                  <p className="font-heading text-lg font-bold sm:text-base">Les autres aventures</p>
                  <button type="button" className="rounded-full p-1.5 hover:bg-ink/5" aria-label="Fermer" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><X className="size-5" /></button>
                </div>
                <ul className="flex-1 overflow-y-auto p-2">
                  {others.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-ink-soft">De nouvelles aventures arrivent bientôt.</li>
                  )}
                  {others.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/aventures/${p.slug}`} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white focus-visible:bg-white">
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream-dark/30">
                          {p.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="56px" className="object-cover" /> : <PlaceholderArt universe={p.universe} hideLabel />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-heading font-semibold">{p.name}</span>
                            {p.isNew && <span className="shrink-0 rounded-full bg-honey px-2 py-0.5 text-[10px] font-bold">Nouveau</span>}
                          </span>
                          <span className="block text-xs text-ink-soft">{formatAgeRange(p.ageMin, p.ageMax)}{p.universe ? ` · ${p.universe}` : ""}</span>
                        </span>
                        <span className="shrink-0 text-right font-heading font-bold">
                          {formatPrice(p.priceCents, p.currency)}
                          {p.compareAtCents != null && <span className="block text-[11px] font-semibold text-ink-muted line-through">{formatPrice(p.compareAtCents, p.currency)}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line p-3">
                  <Button asChild variant="soft" className="w-full"><Link href="/boutique">Voir toute la boutique</Link></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
