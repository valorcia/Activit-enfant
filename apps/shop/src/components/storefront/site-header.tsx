"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart, cartCount } from "@/lib/cart/store";
import { cn } from "@/lib/utils";
import type { BrandSettings, HomepageSettings, NavigationSettings } from "@/lib/schemas/settings";

interface CategoryLink { slug: string; name: string; color: string | null; icon: string | null }

export function SiteHeader({ brand, navigation, banner, categories }: { brand: BrandSettings; navigation: NavigationSettings; banner: HomepageSettings["banner"]; categories: CategoryLink[] }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const openCart = useCart((s) => s.open);
  const count = hydrated ? cartCount(items) : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  const bannerColor = { coral: "bg-coral text-white", honey: "bg-honey text-ink", sage: "bg-sage text-ink", sky: "bg-sky text-ink", lavender: "bg-lavender text-ink" }[banner.color];

  return (
    <header className={cn("sticky top-0 z-40 transition-shadow", scrolled && "shadow-soft")}>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Aller au contenu</a>
      {banner.enabled && banner.text && (
        <div className={cn("text-center text-sm font-bold py-2 px-4", bannerColor)}>
          {banner.href ? <Link href={banner.href} className="underline-offset-4 hover:underline">{banner.text}</Link> : banner.text}
        </div>
      )}
      <div className="bg-cream/90 backdrop-blur-md border-b border-line/60">
        <div className="container-shell flex h-16 items-center justify-between gap-4 sm:h-20">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label={`${brand.name} — accueil`}>
            {brand.logoUrl ? (
              <Image src={brand.logoUrl} alt={brand.name} width={160} height={48} className="h-9 w-auto sm:h-11" priority />
            ) : (
              <span className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-2xl bg-coral text-white shadow-[0_4px_0_0_color-mix(in_oklab,var(--brand-coral)_70%,black)] rotate-[-6deg]">
                  <Icon name="box" className="size-5" />
                </span>
                <span className="font-heading text-xl font-bold leading-none sm:text-2xl">{brand.logoText ?? brand.name}</span>
              </span>
            )}
          </Link>

          <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-1">
            {navigation.header.map((l) => (
              <Link key={l.href} href={l.href} className={cn("rounded-full px-4 py-2 font-heading text-[15px] font-semibold text-ink/80 transition-colors hover:bg-white hover:text-ink", pathname === l.href && "bg-white text-ink")}>{l.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="Rechercher">
              <Link href="/boutique?focus=recherche"><Search className="size-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`} onClick={openCart} className="relative">
              <ShoppingBag className="size-5" />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 h-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white">{count}</span>}
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-b border-line bg-cream shadow-soft">
          <nav aria-label="Navigation mobile" className="container-shell flex flex-col py-3">
            {navigation.header.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 font-heading text-lg font-semibold hover:bg-white">{l.label}</Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 pb-2">
              {categories.map((c) => (
                <Link key={c.slug} href={`/categories/${c.slug}`} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold shadow-sm" style={{ color: c.color ?? undefined }}>
                  <Icon name={c.icon ?? "sparkles"} className="size-4" /> <span className="text-ink">{c.name}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
