import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Quote, Clock, Users, FileText, Layers } from "lucide-react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getApprovedReviews, getBestsellers, getCategories, getFeaturedProducts, getNewProducts, getPublishedBundles } from "@/lib/catalog";
import type { HomepageSection } from "@/lib/schemas/settings";
import { formatAgeRange, formatDuration, formatPlayers, formatDate } from "@/lib/utils";
import { effectivePrice } from "@/lib/pricing";
import { getFlagshipProduct } from "@/lib/flagship";
import { parseKitContents, parseSellingPoints } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Stars } from "@/components/ui/misc";
import { ProductGrid } from "@/components/storefront/product-card";
import { BundleCard } from "@/components/storefront/bundle-card";
import { SectionHeading } from "@/components/storefront/section-heading";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { HeroArt } from "@/components/storefront/hero-art";
import { JsonLd } from "@/components/storefront/json-ld";
import { Reveal, Float } from "@/components/storefront/motion";
import { Price } from "@/components/storefront/price";
import { PlaceholderArt } from "@/components/storefront/placeholder-art";
import { BuyNowButton } from "@/components/storefront/buy-now-button";
import { TrustBadges } from "@/components/storefront/trust-badges";
import { HomeStickyCta } from "@/components/storefront/home-sticky-cta";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const revalidate = 300;

const getLatestPosts = unstable_cache(
  async () => prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 3, select: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true } }),
  ["home-latest-posts"],
  { tags: ["blog"], revalidate: 600 },
);

const CATEGORY_TINTS = ["bg-coral-light", "bg-sage-light", "bg-honey-light", "bg-lavender-light", "bg-sky-light"];

export default async function HomePage() {
  const settings = await getSettings();
  const { homepage, brand, navigation, conversion } = settings;
  const [categories, bestsellers, featured, newest, bundles, reviews, posts, flagship] = await Promise.all([
    getCategories(),
    getBestsellers(8),
    getFeaturedProducts(homepage.featuredProductIds, 4),
    getNewProducts(8),
    getPublishedBundles(3),
    getApprovedReviews(6),
    homepage.sectionsOrder.includes("blog") ? getLatestPosts() : Promise.resolve([]),
    getFlagshipProduct(conversion.flagshipProductId, homepage.featuredProductIds),
  ]);

  const funnel = conversion.heroMode === "funnel" && !!flagship;
  const price = flagship ? effectivePrice(flagship) : null;
  const flagshipImg = flagship?.images[0] ?? null;
  const flagshipHref = flagship ? `/aventures/${flagship.slug}` : "/boutique";
  const kit = flagship ? parseKitContents(flagship.kitContents) : [];
  const points = flagship ? parseSellingPoints(flagship.sellingPoints) : [];
  const buyProps = flagship && price ? { kind: "product" as const, id: flagship.id, name: flagship.name, priceCents: price.priceCents, currency: flagship.currency, label: conversion.buyNowLabel } : null;
  const faqData = conversion.faq.length ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: conversion.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  } : null;

  const sections: Record<HomepageSection, React.ReactNode> = {
    hero: funnel && flagship && price && buyProps ? (
      <section key="hero" className="relative overflow-hidden" aria-labelledby="hero-title">
        <div className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-sky/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-honey/40 blur-3xl" aria-hidden />
        <div className="container-shell grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="relative z-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 font-heading text-sm font-bold text-ink shadow-card">
              <Icon name="sparkles" className="size-4 text-honey-dark" /> {flagship.category?.name ?? "Kit d'activités à imprimer"} · {formatAgeRange(flagship.ageMin, flagship.ageMax)}
            </p>
            <h1 id="hero-title" className="font-heading text-4xl font-bold leading-[1.05] text-balance sm:text-5xl lg:text-6xl">{homepage.hero.title}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft text-pretty sm:text-xl">{flagship.tagline ?? homepage.hero.subtitle}</p>
            {flagship.ratingAvg && flagship.reviewCount > 0 && (
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft"><Stars rating={flagship.ratingAvg} /> {flagship.ratingAvg.toFixed(1)}/5 · {flagship.reviewCount} avis vérifié{flagship.reviewCount > 1 ? "s" : ""}</p>
            )}
            <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
              <Price priceCents={price.priceCents} compareAtCents={price.compareAtCents} currency={flagship.currency} size="xl" />
              {price.isOnSale && <span className="rounded-full bg-coral px-3 py-1 font-heading text-sm font-bold text-white">-{price.discountPercent} %</span>}
              <span className="text-sm text-ink-muted">TTC · fichier PDF · téléchargement immédiat</span>
            </div>
            {conversion.urgency.enabled && conversion.urgency.text && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-honey-light px-3 py-1.5 text-sm font-bold text-honey-dark"><Clock className="size-4" /> {conversion.urgency.text}</p>
            )}
            <div id="home-cta" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <BuyNowButton {...buyProps} size="xl" className="w-full sm:w-auto" />
              <Button asChild size="lg" variant="outline"><Link href={flagshipHref}>Voir le détail <ArrowRight className="size-5" /></Link></Button>
            </div>
            <TrustBadges badges={conversion.trustBadges} className="mt-5" />
          </div>
          <div className="relative">
            <Float className="relative z-10">
              <Link href={flagshipHref} className="card-soft block overflow-hidden p-2 rotate-[1.5deg]" aria-label={flagship.name}>
                {flagshipImg ? (
                  <Image src={flagshipImg.url} alt={flagshipImg.alt ?? flagship.name} width={960} height={720} priority className="aspect-[4/3] w-full rounded-[calc(var(--radius-card)-0.5rem)] object-cover" />
                ) : homepage.hero.imageUrl ? (
                  <Image src={homepage.hero.imageUrl} alt="" width={960} height={720} priority className="aspect-[4/3] w-full rounded-[calc(var(--radius-card)-0.5rem)] object-cover" />
                ) : (
                  <div className="aspect-[4/3] overflow-hidden rounded-[calc(var(--radius-card)-0.5rem)]"><PlaceholderArt universe={flagship.universe} label="Illustration à venir" /></div>
                )}
              </Link>
            </Float>
            <div className="absolute -bottom-6 -left-4 z-20 hidden rotate-[-6deg] rounded-2xl bg-honey px-4 py-3 font-heading text-sm font-bold shadow-soft sm:block">
              Prêt à imprimer 🖨️
            </div>
            <div className="absolute -right-3 -top-4 z-20 hidden rotate-[5deg] rounded-2xl bg-coral px-4 py-3 font-heading text-sm font-bold text-white shadow-soft sm:block">
              PDF immédiat 📩
            </div>
          </div>
        </div>
        <HomeStickyCta product={{ id: flagship.id, name: flagship.name, priceCents: price.priceCents, currency: flagship.currency }} label={conversion.buyNowLabel} />
      </section>
    ) : (
      <section key="hero" className="relative overflow-hidden" aria-labelledby="hero-title">
        <div className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-sky/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-lavender/40 blur-3xl" aria-hidden />
        <div className="container-shell grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="relative z-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 font-heading text-sm font-bold text-ink shadow-card">
              <Icon name="sparkles" className="size-4 text-honey-dark" /> Kits d&apos;activités à imprimer · 3 à 12 ans
            </p>
            <h1 id="hero-title" className="font-heading text-4xl font-bold leading-[1.05] text-balance sm:text-5xl lg:text-6xl">{homepage.hero.title}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft text-pretty sm:text-xl">{homepage.hero.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href={homepage.hero.primaryCta.href}>{homepage.hero.primaryCta.label} <ArrowRight className="size-5" /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href={homepage.hero.secondaryCta.href}>{homepage.hero.secondaryCta.label}</Link></Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-ink/80">
              {homepage.hero.arguments.map((a) => (
                <li key={a.label} className="inline-flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-sage-light text-sage-dark"><Icon name={a.icon} className="size-4" /></span>
                  {a.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <Float className="relative z-10">
              <div className="card-soft overflow-hidden p-2 rotate-[1.5deg]">
                {homepage.hero.imageUrl ? (
                  <Image src={homepage.hero.imageUrl} alt="" width={960} height={720} priority className="aspect-[4/3] w-full rounded-[calc(var(--radius-card)-0.5rem)] object-cover" />
                ) : (
                  <HeroArt className="rounded-[calc(var(--radius-card)-0.5rem)] overflow-hidden" />
                )}
              </div>
            </Float>
            <div className="absolute -bottom-6 -left-4 z-20 hidden rotate-[-6deg] rounded-2xl bg-honey px-4 py-3 font-heading text-sm font-bold shadow-soft sm:block">
              Prêt à imprimer 🖨️
            </div>
            <div className="absolute -right-3 -top-4 z-20 hidden rotate-[5deg] rounded-2xl bg-coral px-4 py-3 font-heading text-sm font-bold text-white shadow-soft sm:block">
              PDF immédiat 📩
            </div>
          </div>
        </div>
      </section>
    ),

    "funnel-offer": flagship && price && buyProps ? (
      <section key="offer" className="bg-white/70 py-14 sm:py-20" aria-labelledby="offer-title">
        <div className="container-shell grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div>
            <Reveal><SectionHeading eyebrow="Ce que vous recevez" title={kit.length ? "Tout est inclus dans votre kit" : "Pourquoi les familles l'adorent"} description={flagship.shortDescription ?? undefined} /></Reveal>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(kit.length ? kit.map((k) => ({ title: k.title, description: k.description, icon: k.icon ?? "file-text", quantity: k.quantity })) : (points.length ? points : [
                { title: "Simple à organiser", description: "Imprimez, cachez les indices, lancez l'aventure.", icon: "list-checks" },
                { title: "Une activité originale", description: "Une histoire immersive pensée pour captiver les enfants.", icon: "sparkles" },
                { title: "Des moments partagés", description: "Une aventure à vivre ensemble, en famille ou entre amis.", icon: "heart" },
                { title: "Impression à domicile", description: "Format PDF, compatible avec toutes les imprimantes.", icon: "printer" },
              ]).map((p) => ({ ...p, quantity: undefined as number | undefined }))).map((it, i) => (
                <Reveal as="li" key={`${it.title}-${i}`} delay={i * 0.05} className="card-soft flex gap-3 p-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral-light text-coral-dark"><Icon name={it.icon ?? "file-text"} className="size-5" /></span>
                  <div>
                    <p className="font-heading font-bold leading-tight">{it.title}{it.quantity ? <span className="ml-2 rounded-full bg-honey-light px-2 py-0.5 text-xs font-bold text-honey-dark">× {it.quantity}</span> : null}</p>
                    {it.description && <p className="mt-1 text-sm text-ink-soft">{it.description}</p>}
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal className="lg:sticky lg:top-24">
            <div className="card-soft overflow-hidden">
              <div className="relative aspect-[16/10] bg-cream-dark/30">
                {flagshipImg ? <Image src={flagshipImg.url} alt="" fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" /> : <PlaceholderArt universe={flagship.universe} />}
              </div>
              <div className="p-6">
                <h3 className="font-heading text-2xl font-bold leading-tight">{flagship.name}</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-ink-soft"><Users className="size-4 text-sage-dark" /><dt className="sr-only">Âge</dt><dd className="font-semibold">{formatAgeRange(flagship.ageMin, flagship.ageMax)}</dd></div>
                  {flagship.durationMinutes ? <div className="flex items-center gap-2 text-ink-soft"><Clock className="size-4 text-sage-dark" /><dt className="sr-only">Durée</dt><dd className="font-semibold">{formatDuration(flagship.durationMinutes)}</dd></div> : null}
                  {flagship.playersMin || flagship.playersMax ? <div className="flex items-center gap-2 text-ink-soft"><Layers className="size-4 text-sage-dark" /><dt className="sr-only">Joueurs</dt><dd className="font-semibold">{formatPlayers(flagship.playersMin, flagship.playersMax)}</dd></div> : null}
                  {flagship.pageCount ? <div className="flex items-center gap-2 text-ink-soft"><FileText className="size-4 text-sage-dark" /><dt className="sr-only">Pages</dt><dd className="font-semibold">{flagship.pageCount} pages · {flagship.fileFormat}</dd></div> : <div className="flex items-center gap-2 text-ink-soft"><FileText className="size-4 text-sage-dark" /><dd className="font-semibold">Fichier {flagship.fileFormat}</dd></div>}
                </dl>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <Price priceCents={price.priceCents} compareAtCents={price.compareAtCents} currency={flagship.currency} size="lg" />
                  {price.isOnSale && <span className="rounded-full bg-coral px-3 py-1 font-heading text-xs font-bold text-white">-{price.discountPercent} %</span>}
                </div>
                <BuyNowButton {...buyProps} size="lg" className="mt-4 w-full" />
                <Link href={flagshipHref} className="mt-3 block text-center text-sm font-bold text-coral-dark underline-offset-4 hover:underline">Voir la fiche complète</Link>
                <TrustBadges badges={conversion.trustBadges.slice(0, 2)} compact className="mt-4 justify-center" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    ) : null,

    guarantee: conversion.guarantee.enabled ? (
      <section key="guarantee" className="container-shell py-10 sm:py-14" aria-labelledby="guarantee-title">
        <Reveal>
          <div className="flex flex-col items-center gap-5 rounded-[2rem] border-2 border-sage bg-sage-light px-6 py-8 text-center sm:flex-row sm:text-left sm:px-10">
            <span className="grid size-20 shrink-0 place-items-center rounded-full bg-white text-sage-dark shadow-card"><Icon name={conversion.guarantee.icon} className="size-10" /></span>
            <div>
              <h2 id="guarantee-title" className="font-heading text-2xl font-bold sm:text-3xl">{conversion.guarantee.title}</h2>
              <p className="mt-2 text-ink-soft text-pretty">{conversion.guarantee.text}</p>
            </div>
          </div>
        </Reveal>
      </section>
    ) : null,

    faq: conversion.faq.length > 0 ? (
      <section key="faq" className="container-shell py-14 sm:py-20" aria-labelledby="home-faq-title">
        {faqData && <JsonLd data={faqData} />}
        <div className="mx-auto max-w-3xl">
          <Reveal><SectionHeading align="center" eyebrow="Vos questions" title="Tout ce qu'il faut savoir avant de commander" /></Reveal>
          <Accordion type="single" collapsible className="card-soft px-6">
            {conversion.faq.map((f, i) => (
              <AccordionItem key={i} value={`home-q-${i}`}>
                <AccordionTrigger>{f.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    ) : null,

    "final-cta": (
      <section key="final-cta" className="container-shell py-14 sm:py-20" aria-labelledby="final-cta-title">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-coral px-6 py-12 text-center text-white sm:px-12 lg:py-16">
            <div className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-honey/40 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -right-10 size-64 rounded-full bg-white/20 blur-3xl" aria-hidden />
            <div className="relative mx-auto max-w-2xl">
              <h2 id="final-cta-title" className="font-heading text-3xl font-bold leading-tight text-balance sm:text-5xl">{conversion.finalCta.title}</h2>
              <p className="mt-4 text-lg text-white/90 text-pretty">{conversion.finalCta.text}</p>
              {flagship && price && buyProps ? (
                <>
                  <p className="mt-6 font-heading text-lg">{flagship.name} · <span className="text-2xl font-bold">{(price.priceCents / 100).toLocaleString("fr-FR", { style: "currency", currency: flagship.currency })}</span>{price.compareAtCents ? <span className="ml-2 text-base text-white/70 line-through">{(price.compareAtCents / 100).toLocaleString("fr-FR", { style: "currency", currency: flagship.currency })}</span> : null}</p>
                  <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <BuyNowButton {...buyProps} size="xl" variant="secondary" className="w-full sm:w-auto" />
                    <Button asChild size="lg" variant="outline" className="border-white/60 bg-white/10 text-white hover:bg-white hover:text-ink"><Link href="/boutique">Voir toutes les aventures</Link></Button>
                  </div>
                </>
              ) : (
                <div className="mt-6"><Button asChild size="xl" variant="secondary"><Link href="/boutique">Découvrir la boutique <ArrowRight className="size-5" /></Link></Button></div>
              )}
              <TrustBadges badges={conversion.trustBadges} compact className="mt-6 justify-center [&_li]:text-white/90 [&_span]:bg-white/20 [&_span]:text-white" />
            </div>
          </div>
        </Reveal>
      </section>
    ),

    categories: categories.length > 0 ? (
      <section key="categories" className="container-shell py-14 sm:py-20" aria-labelledby="cat-title">
        <Reveal>
          <SectionHeading eyebrow="Univers" title="Choisissez votre terrain de jeu" description="Chasses au trésor, cahiers d'activités, kits de fête ou histoires : tout est prêt à imprimer." href="/boutique" linkLabel="Toute la boutique" />
        </Reveal>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c, i) => (
            <Reveal as="li" key={c.id} delay={i * 0.06}>
              <Link href={`/categories/${c.slug}`} className={`group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]} p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift`}>
                <div className="relative mb-5 aspect-[5/3] overflow-hidden rounded-2xl bg-white/70">
                  {c.illustrationUrl ? (
                    <Image src={c.illustrationUrl} alt="" fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="grid size-16 place-items-center rounded-full text-white shadow-soft transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" style={{ backgroundColor: c.color ?? "var(--brand-coral)" }}>
                        <Icon name={c.icon ?? "sparkles"} className="size-8" />
                      </span>
                      <span className="absolute bottom-2 right-3 text-[10px] font-bold uppercase tracking-wide text-ink-muted">Illustration à venir</span>
                    </div>
                  )}
                </div>
                <h3 className="font-heading text-xl font-bold">{c.name}</h3>
                {c.description && <p className="mt-1 flex-1 text-sm text-ink-soft">{c.description}</p>}
                <span className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-white px-4 py-2 font-heading text-sm font-bold shadow-sm transition-colors group-hover:bg-ink group-hover:text-white" style={{ color: c.color ?? undefined }}>
                  <span className="group-hover:text-white">Découvrir</span> <ArrowRight className="size-4 text-ink group-hover:text-white" />
                </span>
                {c._count.products > 0 && <span className="absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink-soft">{c._count.products} kit{c._count.products > 1 ? "s" : ""}</span>}
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>
    ) : null,

    bestsellers: (featured.length > 0 || bestsellers.length > 0) ? (
      <section key="bestsellers" className="bg-white/60 py-14 sm:py-20" aria-labelledby="best-title">
        <div className="container-shell">
          <Reveal><SectionHeading eyebrow="Les préférées des familles" title="Meilleures ventes" description="Les aventures les plus plébiscitées par les parents et les enfants." href="/boutique?tri=popularite" linkLabel="Voir les plus populaires" /></Reveal>
          <ProductGrid products={(featured.length >= 4 ? featured : bestsellers).slice(0, 8)} priorityCount={4} />
        </div>
      </section>
    ) : null,

    "how-it-works": (
      <section key="how" className="container-shell py-14 sm:py-20" aria-labelledby="how-title">
        <Reveal><SectionHeading align="center" eyebrow="Simple comme bonjour" title="Comment ça marche ?" description="Trois étapes et l'aventure commence à la maison." /></Reveal>
        <ol className="relative grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-14 hidden border-t-2 border-dashed border-ink/15 md:block" aria-hidden />
          {homepage.howItWorks.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 0.1} className="relative flex flex-col items-center text-center">
              <div className={`relative grid size-28 place-items-center rounded-full ${["bg-coral-light", "bg-honey-light", "bg-sage-light"][i % 3]} blob-tl shadow-card`}>
                <Icon name={step.icon} className={`size-11 ${["text-coral-dark", "text-honey-dark", "text-sage-dark"][i % 3]}`} />
                <span className="absolute -right-1 -top-1 grid size-9 place-items-center rounded-full bg-ink font-heading text-sm font-bold text-white shadow-soft">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-heading text-xl font-bold">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm text-ink-soft">{step.description}</p>
            </Reveal>
          ))}
        </ol>
      </section>
    ),

    new: newest.length > 0 ? (
      <section key="new" className="container-shell py-14 sm:py-20" aria-labelledby="new-title">
        <Reveal><SectionHeading eyebrow="Fraîchement imprimables" title="Nouveautés" description="Une nouvelle aventure chaque semaine : voici les dernières arrivées." href="/boutique?tri=nouveautes" linkLabel="Toutes les nouveautés" /></Reveal>
        <ProductGrid products={newest.slice(0, 4)} />
      </section>
    ) : null,

    bundles: bundles.length > 0 ? (
      <section key="bundles" className="bg-lavender-light/60 py-14 sm:py-20" aria-labelledby="bundles-title">
        <div className="container-shell">
          <Reveal><SectionHeading eyebrow="Bons plans" title="Packs et offres groupées" description="Plusieurs aventures réunies à prix doux." href="/packs" linkLabel="Tous les packs" /></Reveal>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b, i) => <Reveal key={b.id} delay={i * 0.08}><BundleCard bundle={b} /></Reveal>)}
          </div>
        </div>
      </section>
    ) : null,

    reviews: reviews.length > 0 ? (
      <section key="reviews" className="container-shell py-14 sm:py-20" aria-labelledby="reviews-title">
        <Reveal><SectionHeading align="center" eyebrow="Ils en parlent" title="Avis des familles" description="Des avis authentiques, vérifiés et modérés." /></Reveal>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal as="li" key={r.id} delay={i * 0.06} className="card-soft relative flex flex-col p-6">
              <Quote className="absolute right-5 top-5 size-8 text-honey/70" aria-hidden />
              <Stars rating={r.rating} />
              {r.title && <p className="mt-3 font-heading text-lg font-bold">{r.title}</p>}
              <p className="mt-2 flex-1 text-sm text-ink-soft leading-relaxed">{r.body}</p>
              <footer className="mt-4 text-xs text-ink-muted">
                <span className="font-bold text-ink">{r.authorName}</span>{r.isVerifiedPurchase && <span className="ml-2 rounded-full bg-sage-light px-2 py-0.5 font-bold text-sage-dark">Achat vérifié</span>}
                <span className="block mt-1">À propos de <Link href={`/aventures/${r.product.slug}`} className="underline">{r.product.name}</Link> · {formatDate(r.createdAt)}</span>
              </footer>
            </Reveal>
          ))}
        </ul>
      </section>
    ) : null,

    newsletter: (
      <section key="newsletter" className="container-shell py-14 sm:py-20" aria-labelledby="nl-title">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-cream sm:px-12 lg:px-16">
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-coral/40 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-sky/30 blur-3xl" aria-hidden />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <p className="font-heading text-sm font-bold uppercase tracking-wider text-honey">Newsletter</p>
                <h2 id="nl-title" className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">Recevez les nouvelles aventures avant tout le monde</h2>
                <p className="mt-3 text-cream/80">Idées d&apos;activités, nouveautés et offres réservées aux abonnés. Pas de spam, désinscription en un clic.</p>
              </div>
              <div className="rounded-3xl bg-white p-5 text-ink sm:p-6"><NewsletterForm source="homepage" /></div>
            </div>
          </div>
        </Reveal>
      </section>
    ),

    blog: posts.length > 0 ? (
      <section key="blog" className="container-shell py-14 sm:py-20" aria-labelledby="blog-title">
        <Reveal><SectionHeading eyebrow="Le blog" title="Idées et conseils pour les parents" href="/blog" linkLabel="Tous les articles" /></Reveal>
        <ul className="grid gap-5 md:grid-cols-3">
          {posts.map((p, i) => (
            <Reveal as="li" key={p.slug} delay={i * 0.06}>
              <Link href={`/blog/${p.slug}`} className="card-soft card-hover group flex h-full flex-col overflow-hidden">
                <div className="relative aspect-[16/9] bg-sky-light">
                  {p.coverImageUrl && <Image src={p.coverImageUrl} alt="" fill sizes="33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-bold text-ink-muted">{formatDate(p.publishedAt)}</p>
                  <h3 className="mt-1 font-heading text-lg font-bold leading-snug">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{p.excerpt}</p>}
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>
    ) : null,
  };

  const socialLinks = Object.values(navigation.social).filter(Boolean) as string[];

  return (
    <>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Organization", name: brand.name, url: env.appUrl, ...(brand.logoUrl ? { logo: brand.logoUrl } : {}), ...(brand.contactEmail ? { email: brand.contactEmail } : {}), ...(socialLinks.length ? { sameAs: socialLinks } : {}) },
        { "@context": "https://schema.org", "@type": "WebSite", name: brand.name, url: env.appUrl, inLanguage: "fr-FR", potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${env.appUrl}/boutique?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
      ]} />
      {homepage.sectionsOrder.map((key) => sections[key])}
    </>
  );
}
