"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormField, FormSection, ListEditor } from "@/components/admin/form-controls";
import { SearchSelect } from "@/components/admin/search-select";
import { UploadField } from "@/components/admin/upload-field";
import { saveSettingAction } from "@/app/actions/admin/settings";
import type { BrandSettings, ConversionSettings, HomepageSettings, HomepageSection, NavigationSettings, ThemeSettings } from "@/lib/schemas/settings";
import type { SettingsKey } from "@/lib/schemas/settings";

const SECTION_LABELS: Record<HomepageSection, string> = { hero: "Hero", "funnel-offer": "Offre produit phare (ce que vous recevez)", categories: "Catégories", bestsellers: "Meilleures ventes", "how-it-works": "Fonctionnement", new: "Nouveautés", bundles: "Packs", reviews: "Avis clients", guarantee: "Garantie", faq: "FAQ / objections", newsletter: "Newsletter", blog: "Blog", "final-cta": "Appel à l'action final" };
const COLOR_LABELS: Record<keyof ThemeSettings["colors"], string> = { cream: "Crème (fond)", coral: "Corail (action)", honey: "Jaune miel", sage: "Vert sauge", sky: "Bleu ciel", lavender: "Lavande", ink: "Texte" };
const HEADING_FONTS = ["Fredoka", "Baloo 2", "Nunito", "Quicksand", "Comfortaa"] as const;
const BODY_FONTS = ["Nunito", "Quicksand", "Inter", "Mulish", "Poppins"] as const;

function useSave() {
  const [pending, start] = useTransition();
  const save = (key: SettingsKey, value: unknown) => start(async () => { const r = await saveSettingAction(key, value); r.ok ? toast.success("Enregistré") : toast.error(r.error); });
  return { pending, save };
}

export function AppearanceForm({ brand: b0, theme: t0, homepage: h0, navigation: n0, conversion: c0, products }: { brand: BrandSettings; theme: ThemeSettings; homepage: HomepageSettings; navigation: NavigationSettings; conversion: ConversionSettings; products: Array<{ id: string; name: string; slug: string }> }) {
  const [brand, setBrand] = useState(b0);
  const [theme, setTheme] = useState(t0);
  const [home, setHome] = useState(h0);
  const [nav, setNav] = useState(n0);
  const [conv, setConv] = useState(c0);
  const { pending, save } = useSave();
  const upd = <T,>(set: React.Dispatch<React.SetStateAction<T>>) => (patch: Partial<T>) => set((s) => ({ ...s, ...patch }));
  const setB = upd(setBrand), setT = upd(setTheme), setH = upd(setHome), setN = upd(setNav), setC = upd(setConv);

  const moveSection = (i: number, d: -1 | 1) => {
    const next = [...home.sectionsOrder];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setH({ sectionsOrder: next });
  };

  return (
    <Tabs defaultValue="brand">
      <TabsList className="mb-4">
        <TabsTrigger value="brand">Marque</TabsTrigger>
        <TabsTrigger value="theme">Couleurs & typographies</TabsTrigger>
        <TabsTrigger value="home">Page d&apos;accueil</TabsTrigger>
        <TabsTrigger value="conversion">Conversion</TabsTrigger>
        <TabsTrigger value="nav">Navigation & pied de page</TabsTrigger>
      </TabsList>

      <TabsContent value="brand">
        <FormSection title="Identité de la marque">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom de la marque" htmlFor="b-name"><Input id="b-name" value={brand.name} onChange={(e) => setB({ name: e.target.value })} /></FormField>
            <FormField label="Texte du logo (si pas d'image)" htmlFor="b-logoText"><Input id="b-logoText" value={brand.logoText ?? ""} onChange={(e) => setB({ logoText: e.target.value || null })} /></FormField>
          </div>
          <FormField label="Slogan" htmlFor="b-tagline"><Input id="b-tagline" value={brand.tagline} onChange={(e) => setB({ tagline: e.target.value })} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FormField label="Logo" hint="PNG ou SVG, fond transparent conseillé">
                {brand.logoUrl && <img src={brand.logoUrl} alt="Logo" className="mb-2 h-12 w-auto" />}
                <UploadField scope="public" accept="image/*" label="Déposer le logo" onUploaded={(f) => "url" in f && setB({ logoUrl: f.url })} />
              </FormField>
              {brand.logoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setB({ logoUrl: null })}>Retirer le logo</Button>}
            </div>
            <div className="space-y-2">
              <FormField label="Favicon" hint="PNG 64×64 ou SVG">
                {brand.faviconUrl && <img src={brand.faviconUrl} alt="Favicon" className="mb-2 size-8" />}
                <UploadField scope="public" accept="image/*" label="Déposer le favicon" onUploaded={(f) => "url" in f && setB({ faviconUrl: f.url })} />
              </FormField>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email de contact" htmlFor="b-email"><Input id="b-email" type="email" value={brand.contactEmail ?? ""} onChange={(e) => setB({ contactEmail: e.target.value || null })} /></FormField>
            <FormField label="Raison sociale (factures)" htmlFor="b-legal"><Input id="b-legal" value={brand.legalName ?? ""} onChange={(e) => setB({ legalName: e.target.value || null })} /></FormField>
            <FormField label="Adresse (factures)" htmlFor="b-addr" className="sm:col-span-2"><Textarea id="b-addr" value={brand.legalAddress ?? ""} onChange={(e) => setB({ legalAddress: e.target.value || null })} className="min-h-[70px]" /></FormField>
            <FormField label="Numéro de TVA" htmlFor="b-vat"><Input id="b-vat" value={brand.vatNumber ?? ""} onChange={(e) => setB({ vatNumber: e.target.value || null })} /></FormField>
          </div>
          <div><Button variant="admin" disabled={pending} onClick={() => save("brand", brand)}>Enregistrer la marque</Button></div>
        </FormSection>
      </TabsContent>

      <TabsContent value="theme">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <FormSection title="Couleurs">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(COLOR_LABELS) as Array<keyof ThemeSettings["colors"]>).map((k) => (
                <label key={k} className="flex items-center gap-3 rounded-xl border border-line p-2">
                  <input type="color" value={theme.colors[k]} onChange={(e) => setT({ colors: { ...theme.colors, [k]: e.target.value } })} className="size-10 cursor-pointer rounded-lg border-0 bg-transparent" aria-label={COLOR_LABELS[k]} />
                  <span className="flex-1 text-sm font-semibold">{COLOR_LABELS[k]}</span>
                  <Input value={theme.colors[k]} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setT({ colors: { ...theme.colors, [k]: e.target.value } })} className="h-8 w-24 font-mono text-xs" />
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Police des titres" htmlFor="t-heading"><NativeSelect id="t-heading" value={theme.fonts.heading} onChange={(e) => setT({ fonts: { ...theme.fonts, heading: e.target.value as ThemeSettings["fonts"]["heading"] } })}>{HEADING_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</NativeSelect></FormField>
              <FormField label="Police du texte" htmlFor="t-body"><NativeSelect id="t-body" value={theme.fonts.body} onChange={(e) => setT({ fonts: { ...theme.fonts, body: e.target.value as ThemeSettings["fonts"]["body"] } })}>{BODY_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</NativeSelect></FormField>
              <FormField label="Arrondis" htmlFor="t-radius"><NativeSelect id="t-radius" value={theme.radius} onChange={(e) => setT({ radius: e.target.value as ThemeSettings["radius"] })}><option value="soft">Doux</option><option value="round">Ronds</option><option value="pill">Très ronds</option></NativeSelect></FormField>
              <label className="flex items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={theme.texture} onChange={(e) => setT({ texture: e.target.checked })} className="size-4 accent-coral" /> Fond légèrement texturé</label>
            </div>
            <div><Button variant="admin" disabled={pending} onClick={() => save("theme", theme)}>Enregistrer le thème</Button></div>
          </FormSection>
          <div className="rounded-2xl border border-line p-4" style={{ background: theme.colors.cream, color: theme.colors.ink }}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-60">Aperçu</p>
            <p className="mt-2 text-2xl font-bold" style={{ fontFamily: `"${theme.fonts.heading}", sans-serif` }}>Des aventures extraordinaires</p>
            <p className="mt-1 text-sm" style={{ fontFamily: `"${theme.fonts.body}", sans-serif` }}>Chasses au trésor et activités à imprimer.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: theme.colors.coral }}>Bouton</span>
              {(["honey", "sage", "sky", "lavender"] as const).map((k) => <span key={k} className="rounded-full px-3 py-2 text-xs font-bold" style={{ background: theme.colors[k] }}>{COLOR_LABELS[k].split(" ")[0]}</span>)}
            </div>
            <p className="mt-3 text-[11px] opacity-60">Les polices s&apos;affichent avec leur rendu réel sur le site après enregistrement.</p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="home">
        <div className="space-y-6">
          <FormSection title="Section hero">
            <FormField label="Titre principal" htmlFor="h-title"><Input id="h-title" value={home.hero.title} onChange={(e) => setH({ hero: { ...home.hero, title: e.target.value } })} /></FormField>
            <FormField label="Sous-titre" htmlFor="h-sub"><Textarea id="h-sub" value={home.hero.subtitle} onChange={(e) => setH({ hero: { ...home.hero, subtitle: e.target.value } })} className="min-h-[70px]" /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Bouton principal — libellé"><Input value={home.hero.primaryCta.label} onChange={(e) => setH({ hero: { ...home.hero, primaryCta: { ...home.hero.primaryCta, label: e.target.value } } })} /></FormField>
              <FormField label="Bouton principal — lien"><Input value={home.hero.primaryCta.href} onChange={(e) => setH({ hero: { ...home.hero, primaryCta: { ...home.hero.primaryCta, href: e.target.value } } })} /></FormField>
              <FormField label="Bouton secondaire — libellé"><Input value={home.hero.secondaryCta.label} onChange={(e) => setH({ hero: { ...home.hero, secondaryCta: { ...home.hero.secondaryCta, label: e.target.value } } })} /></FormField>
              <FormField label="Bouton secondaire — lien"><Input value={home.hero.secondaryCta.href} onChange={(e) => setH({ hero: { ...home.hero, secondaryCta: { ...home.hero.secondaryCta, href: e.target.value } } })} /></FormField>
            </div>
            <FormField label="Grand visuel illustré" hint="Tant qu'aucune image n'est définie, une composition d'emplacements est affichée.">
              {home.hero.imageUrl && <img src={home.hero.imageUrl} alt="" className="mb-2 max-h-48 rounded-xl" />}
              <UploadField scope="public" accept="image/*" label="Déposer l'illustration du hero" onUploaded={(f) => "url" in f && setH({ hero: { ...home.hero, imageUrl: f.url } })} />
              {home.hero.imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setH({ hero: { ...home.hero, imageUrl: null } })}>Retirer</Button>}
            </FormField>
            <FormField label="Arguments (max 4)">
              <ListEditor items={home.hero.arguments} onChange={(items) => setH({ hero: { ...home.hero, arguments: items.slice(0, 4) } })} create={() => ({ icon: "sparkles", label: "" })} addLabel="Ajouter un argument"
                renderItem={(it, u) => <div className="grid gap-2 sm:grid-cols-[140px_1fr]"><Input value={it.icon} onChange={(e) => u({ icon: e.target.value })} placeholder="icône lucide" className="h-9 text-sm" /><Input value={it.label} onChange={(e) => u({ label: e.target.value })} placeholder="Libellé" className="h-9 text-sm" /></div>} />
            </FormField>
          </FormSection>
          <FormSection title="Fonctionnement (étapes)">
            <ListEditor items={home.howItWorks} onChange={(items) => setH({ howItWorks: items.slice(0, 5) })} create={() => ({ title: "", description: "", icon: "sparkles" })} addLabel="Ajouter une étape"
              renderItem={(it, u) => <div className="grid gap-2"><div className="grid gap-2 sm:grid-cols-[140px_1fr]"><Input value={it.icon} onChange={(e) => u({ icon: e.target.value })} placeholder="icône" className="h-9 text-sm" /><Input value={it.title} onChange={(e) => u({ title: e.target.value })} placeholder="Titre" className="h-9 text-sm" /></div><Textarea value={it.description} onChange={(e) => u({ description: e.target.value })} placeholder="Description" className="min-h-[50px] text-sm" /></div>} />
          </FormSection>
          <FormSection title="Ordre des sections">
            <ul className="divide-y divide-line rounded-xl border border-line">
              {home.sectionsOrder.map((s, i) => (
                <li key={s} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-semibold">{i + 1}. {SECTION_LABELS[s]}</span>
                  <span className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Monter" disabled={i === 0} onClick={() => moveSection(i, -1)}><ArrowUp className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Descendre" disabled={i === home.sectionsOrder.length - 1} onClick={() => moveSection(i, 1)}><ArrowDown className="size-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="text-red-700" onClick={() => setH({ sectionsOrder: home.sectionsOrder.filter((x) => x !== s) })}>Masquer</Button>
                  </span>
                </li>
              ))}
            </ul>
            {(Object.keys(SECTION_LABELS) as HomepageSection[]).filter((s) => !home.sectionsOrder.includes(s)).length > 0 && (
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-ink-muted">Sections masquées :</span>
                {(Object.keys(SECTION_LABELS) as HomepageSection[]).filter((s) => !home.sectionsOrder.includes(s)).map((s) => <Button key={s} type="button" variant="soft" size="sm" onClick={() => setH({ sectionsOrder: [...home.sectionsOrder, s] })}>+ {SECTION_LABELS[s]}</Button>)}
              </div>
            )}
          </FormSection>
          <FormSection title="Produits mis en avant" description="Vide = produits marqués « mis en avant » triés par ventes.">
            <SearchSelect options={products.map((p) => ({ value: p.id, label: p.name, hint: p.slug }))} value={home.featuredProductIds} onChange={(v) => setH({ featuredProductIds: v })} placeholder="Rechercher un produit publié…" />
          </FormSection>
          <FormSection title="Bannière d'annonce">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={home.banner.enabled} onChange={(e) => setH({ banner: { ...home.banner, enabled: e.target.checked } })} className="size-4 accent-coral" /> Afficher la bannière en haut du site</label>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
              <FormField label="Texte"><Input value={home.banner.text} onChange={(e) => setH({ banner: { ...home.banner, text: e.target.value } })} /></FormField>
              <FormField label="Lien (facultatif)"><Input value={home.banner.href ?? ""} onChange={(e) => setH({ banner: { ...home.banner, href: e.target.value || null } })} /></FormField>
              <FormField label="Couleur"><NativeSelect value={home.banner.color} onChange={(e) => setH({ banner: { ...home.banner, color: e.target.value as HomepageSettings["banner"]["color"] } })}>{["coral", "honey", "sage", "sky", "lavender"].map((c) => <option key={c} value={c}>{c}</option>)}</NativeSelect></FormField>
            </div>
          </FormSection>
          <div><Button variant="admin" disabled={pending} onClick={() => save("homepage", home)}>Enregistrer la page d&apos;accueil</Button></div>
        </div>
      </TabsContent>


      <TabsContent value="conversion">
        <div className="space-y-6">
          <div className="rounded-2xl border border-honey bg-honey-light px-4 py-3 text-sm text-honey-dark">
            Ces réglages pilotent le tunnel de vente : hero centré sur le produit phare, achat en un clic, réassurance, garantie, order bump, popup de sortie et FAQ d&apos;objections. Aucun chiffre ou avis n&apos;est inventé : seuls vos textes sont affichés.
          </div>
          <FormSection title="Produit phare et achat en un clic">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Mode du hero" hint="« Tunnel » met le produit phare et le bouton d'achat au premier plan ; « Catalogue » garde le hero généraliste.">
                <NativeSelect value={conv.heroMode} onChange={(e) => setC({ heroMode: e.target.value as ConversionSettings["heroMode"] })}>
                  <option value="funnel">Tunnel de vente (produit phare)</option>
                  <option value="catalogue">Catalogue (hero généraliste)</option>
                </NativeSelect>
              </FormField>
              <FormField label="Produit phare" hint="Vide = premier produit mis en avant, sinon meilleure vente.">
                <NativeSelect value={conv.flagshipProductId ?? ""} onChange={(e) => setC({ flagshipProductId: e.target.value || null })}>
                  <option value="">Automatique</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
              </FormField>
            </div>
            <FormField label="Libellé du bouton d'achat" htmlFor="c-buy"><Input id="c-buy" value={conv.buyNowLabel} onChange={(e) => setC({ buyNowLabel: e.target.value })} maxLength={40} /></FormField>
            <FormField label="Badges de confiance (max 6)" hint="Affichés sous les boutons d'achat. Icônes lucide (lock, download, printer, mail, shield-check…).">
              <ListEditor items={conv.trustBadges} onChange={(items) => setC({ trustBadges: items.slice(0, 6) })} create={() => ({ icon: "check", label: "" })} addLabel="Ajouter un badge"
                renderItem={(it, u) => <div className="grid gap-2 sm:grid-cols-[140px_1fr]"><Input value={it.icon} onChange={(e) => u({ icon: e.target.value })} placeholder="icône lucide" className="h-9 text-sm" /><Input value={it.label} onChange={(e) => u({ label: e.target.value })} placeholder="Libellé" className="h-9 text-sm" maxLength={60} /></div>} />
            </FormField>
          </FormSection>

          <FormSection title="Garantie" description="Engagement commercial : à valider avant activation (conditions, délai, modalités de remboursement).">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={conv.guarantee.enabled} onChange={(e) => setC({ guarantee: { ...conv.guarantee, enabled: e.target.checked } })} className="size-4 accent-coral" /> Afficher le bloc garantie</label>
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <FormField label="Icône"><Input value={conv.guarantee.icon} onChange={(e) => setC({ guarantee: { ...conv.guarantee, icon: e.target.value } })} /></FormField>
              <FormField label="Titre"><Input value={conv.guarantee.title} onChange={(e) => setC({ guarantee: { ...conv.guarantee, title: e.target.value } })} maxLength={80} /></FormField>
            </div>
            <FormField label="Texte"><Textarea value={conv.guarantee.text} onChange={(e) => setC({ guarantee: { ...conv.guarantee, text: e.target.value } })} className="min-h-[70px]" maxLength={600} /></FormField>
          </FormSection>

          <FormSection title="Message d'urgence" description="Affiché sous le prix dans le hero. N'activez que des informations vraies (fin de promotion, offre de lancement…).">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={conv.urgency.enabled} onChange={(e) => setC({ urgency: { ...conv.urgency, enabled: e.target.checked } })} className="size-4 accent-coral" /> Afficher le message</label>
            <FormField label="Texte"><Input value={conv.urgency.text} onChange={(e) => setC({ urgency: { ...conv.urgency, text: e.target.value } })} maxLength={160} placeholder="Ex. Prix de lancement jusqu'au 30 novembre" /></FormField>
          </FormSection>

          <FormSection title="Order bump (panier)" description="Propose un second produit à ajouter en une case à cocher dans le panier.">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={conv.orderBump.enabled} onChange={(e) => setC({ orderBump: { ...conv.orderBump, enabled: e.target.checked } })} className="size-4 accent-coral" /> Activer l&apos;order bump</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Produit proposé" hint="Vide = produit recommandé ou meilleure vente absente du panier.">
                <NativeSelect value={conv.orderBump.productId ?? ""} onChange={(e) => setC({ orderBump: { ...conv.orderBump, productId: e.target.value || null } })}>
                  <option value="">Automatique</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </NativeSelect>
              </FormField>
              <FormField label="Titre"><Input value={conv.orderBump.title} onChange={(e) => setC({ orderBump: { ...conv.orderBump, title: e.target.value } })} maxLength={80} /></FormField>
            </div>
            <FormField label="Texte"><Input value={conv.orderBump.text} onChange={(e) => setC({ orderBump: { ...conv.orderBump, text: e.target.value } })} maxLength={200} /></FormField>
          </FormSection>

          <FormSection title="Popup de sortie" description="Affichée une seule fois par visiteur, jamais sur les pages de paiement.">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={conv.exitPopup.enabled} onChange={(e) => setC({ exitPopup: { ...conv.exitPopup, enabled: e.target.checked } })} className="size-4 accent-coral" /> Activer la popup</label>
            <div className="grid gap-4 sm:grid-cols-[1fr_200px_140px]">
              <FormField label="Titre"><Input value={conv.exitPopup.title} onChange={(e) => setC({ exitPopup: { ...conv.exitPopup, title: e.target.value } })} maxLength={80} /></FormField>
              <FormField label="Code promo (facultatif)" hint="Doit exister dans Codes promo."><Input value={conv.exitPopup.couponCode ?? ""} onChange={(e) => setC({ exitPopup: { ...conv.exitPopup, couponCode: e.target.value.toUpperCase() || null } })} maxLength={40} /></FormField>
              <FormField label="Délai (s)"><Input type="number" min={5} max={300} value={conv.exitPopup.delaySeconds} onChange={(e) => setC({ exitPopup: { ...conv.exitPopup, delaySeconds: Math.min(300, Math.max(5, Number(e.target.value) || 25)) } })} /></FormField>
            </div>
            <FormField label="Texte"><Textarea value={conv.exitPopup.text} onChange={(e) => setC({ exitPopup: { ...conv.exitPopup, text: e.target.value } })} className="min-h-[60px]" maxLength={300} /></FormField>
          </FormSection>

          <FormSection title="FAQ / objections (accueil)" description="Répond aux freins à l'achat. Les FAQ propres à chaque produit se gèrent dans la fiche produit.">
            <ListEditor items={conv.faq} onChange={(items) => setC({ faq: items.slice(0, 12) })} create={() => ({ question: "", answer: "" })} addLabel="Ajouter une question"
              renderItem={(it, u) => <div className="grid gap-2"><Input value={it.question} onChange={(e) => u({ question: e.target.value })} placeholder="Question" className="h-9 text-sm" maxLength={200} /><Textarea value={it.answer} onChange={(e) => u({ answer: e.target.value })} placeholder="Réponse" className="min-h-[60px] text-sm" maxLength={1000} /></div>} />
          </FormSection>

          <FormSection title="Appel à l'action final">
            <FormField label="Titre"><Input value={conv.finalCta.title} onChange={(e) => setC({ finalCta: { ...conv.finalCta, title: e.target.value } })} maxLength={120} /></FormField>
            <FormField label="Texte"><Input value={conv.finalCta.text} onChange={(e) => setC({ finalCta: { ...conv.finalCta, text: e.target.value } })} maxLength={240} /></FormField>
          </FormSection>

          <div><Button variant="admin" disabled={pending} onClick={() => save("conversion", conv)}>Enregistrer la conversion</Button></div>
        </div>
      </TabsContent>

      <TabsContent value="nav">
        <div className="space-y-6">
          <FormSection title="Liens du menu principal (max 8)">
            <ListEditor items={nav.header} onChange={(items) => setN({ header: items.slice(0, 8) })} create={() => ({ label: "", href: "/" })} addLabel="Ajouter un lien"
              renderItem={(it, u) => <div className="grid gap-2 sm:grid-cols-2"><Input value={it.label} onChange={(e) => u({ label: e.target.value })} placeholder="Libellé" className="h-9 text-sm" /><Input value={it.href} onChange={(e) => u({ href: e.target.value })} placeholder="/boutique" className="h-9 text-sm" /></div>} />
          </FormSection>
          <FormSection title="Colonnes du pied de page (max 4)">
            <ListEditor items={nav.footerColumns} onChange={(items) => setN({ footerColumns: items.slice(0, 4) })} create={() => ({ title: "", links: [] })} addLabel="Ajouter une colonne" itemLabel={(i) => `Colonne ${i + 1}`}
              renderItem={(col, u) => (
                <div className="space-y-2">
                  <Input value={col.title} onChange={(e) => u({ title: e.target.value })} placeholder="Titre de la colonne" className="h-9 text-sm" />
                  <ListEditor items={col.links} onChange={(links) => u({ links: links.slice(0, 8) })} create={() => ({ label: "", href: "/" })} addLabel="Ajouter un lien" itemLabel={(i) => `Lien ${i + 1}`}
                    renderItem={(l, ul) => <div className="grid gap-2 sm:grid-cols-2"><Input value={l.label} onChange={(e) => ul({ label: e.target.value })} placeholder="Libellé" className="h-9 text-sm" /><Input value={l.href} onChange={(e) => ul({ href: e.target.value })} placeholder="/…" className="h-9 text-sm" /></div>} />
                </div>
              )} />
          </FormSection>
          <FormSection title="Texte et réseaux sociaux">
            <FormField label="Texte du pied de page"><Textarea value={nav.footerText} onChange={(e) => setN({ footerText: e.target.value })} className="min-h-[70px]" /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["instagram", "facebook", "pinterest", "tiktok", "youtube"] as const).map((k) => (
                <FormField key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}><Input value={nav.social[k] ?? ""} onChange={(e) => setN({ social: { ...nav.social, [k]: e.target.value || null } })} placeholder="https://…" /></FormField>
              ))}
            </div>
          </FormSection>
          <div><Button variant="admin" disabled={pending} onClick={() => save("navigation", nav)}>Enregistrer la navigation</Button></div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
