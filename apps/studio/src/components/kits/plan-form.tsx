"use client";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { KIT_AGE_RANGES, TONES, UNIVERSES, defaultTypeForPreset, kitType, typeAllowedForPreset, typesForPreset } from "@/lib/kits/types";
import { ageRangeLabel } from "@/lib/schemas/activity";
import type { KitPlan } from "@/lib/kits/schemas";
import { siteBySlug, SITE_STATUS_LABELS, type Site } from "@/lib/universes/sites";
import { UniverseSelect } from "@/components/universes/universe-select";
import { MAX_ITEMS_PER_BOOK } from "@/lib/kits/limits";
import { ColoringPlanOptions, type ColoringAiView } from "./coloring-options";

export const SHOP_CATEGORIES = [
  { slug: "chasses-au-tresor", name: "Chasses au trésor" },
  { slug: "activites-educatives", name: "Activités éducatives" },
  { slug: "evenements", name: "Événements" },
  { slug: "histoires-et-aventures", name: "Histoires et aventures" },
];

/** Formulaire de plan de kit (aperçu éditable après analyse d'un brief, ou personnalisation). */
export function KitPlanForm({ plan, onChange, categories, sites, coloringAi }: { plan: KitPlan; onChange: (p: KitPlan) => void; categories?: Array<{ slug: string; name: string }>; sites?: Site[]; coloringAi?: ColoringAiView }) {
  const set = <K extends keyof KitPlan>(k: K, v: KitPlan[K]) => onChange({ ...plan, [k]: v });
  const def = kitType(plan.kitType);
  const site = sites ? siteBySlug(sites, plan.siteSlug) : undefined;
  const preset = site?.preset;
  const cats = site?.categories.length ? site.categories : categories?.length ? categories : SHOP_CATEGORIES;
  const ages = Array.from(new Set([...KIT_AGE_RANGES, plan.ageRange]));
  const types = typesForPreset(preset);
  const adult = def.format === "guide" || def.format === "recipes";
  const coloring = def.format === "coloring";
  const categoryFor = (slug: string, list = cats) => (list.some((c) => c.slug === slug) ? slug : list[0]?.slug ?? slug);
  const withType = (base: KitPlan, key: string, list = cats): KitPlan => {
    const d = kitType(key);
    return { ...base, kitType: d.key, count: d.defaultCount, ageRange: d.defaultAge, shopCategorySlug: categoryFor(d.shopCategory, list), priceCents: d.defaultPriceCents };
  };
  const changeSite = (slug: string | null) => {
    const s = sites ? siteBySlug(sites, slug) : undefined;
    const next: KitPlan = { ...plan, siteSlug: slug ?? undefined };
    const list = s?.categories.length ? s.categories : cats;
    if (s && !typeAllowedForPreset(plan.kitType, s.preset)) return onChange(withType(next, defaultTypeForPreset(s.preset), list));
    onChange({ ...next, shopCategorySlug: categoryFor(plan.shopCategorySlug ?? def.shopCategory, list) });
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sites && sites.length > 0 && (
        <Field label="Univers de la boutique" hint={site ? `${site.audience.name} · ${site.primaryDomain ?? site.url ?? ""}${site.status !== "ACTIVE" ? ` · ${SITE_STATUS_LABELS[site.status]}` : ""}` : "Le préréglage de l'univers fixe le ton, la charte d'illustration et le thème PDF."} className="md:col-span-2">
          <UniverseSelect sites={sites} value={plan.siteSlug} onChange={changeSite} />
        </Field>
      )}
      <Field label="Type d'e-book">
        <Select value={plan.kitType} onChange={(e) => onChange(withType(plan, e.target.value))}>
          {(types.some((k) => k.key === plan.kitType) ? types : [def, ...types]).map((k) => <option key={k.key} value={k.key}>{k.label}{k.family === "activites" ? " (livre d'activités)" : ""}</option>)}
        </Select>
      </Field>
      <Field label="Tranche d'âge">
        <Select value={plan.ageRange} onChange={(e) => set("ageRange", e.target.value)}>{ages.map((a) => <option key={a} value={a}>{ageRangeLabel(a)}</option>)}</Select>
      </Field>
      <Field label="Titre"><Input value={plan.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <Field label="Sous-titre (bénéfice principal)"><Input value={plan.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
      <Field label={adult ? "Thème" : "Univers du récit"} hint="Choisissez ou saisissez librement.">
        <Input list="kit-universes" value={plan.universe} onChange={(e) => set("universe", e.target.value)} />
        <datalist id="kit-universes">{UNIVERSES.map((u) => <option key={u} value={u} />)}</datalist>
      </Field>
      <Field label="Ton">
        <Input list="kit-tones" value={plan.tone} onChange={(e) => set("tone", e.target.value)} />
        <datalist id="kit-tones">{TONES.map((u) => <option key={u} value={u} />)}</datalist>
      </Field>
      {!adult && !coloring && (
        <>
          <Field label="Personnage principal"><Input value={plan.heroName} onChange={(e) => set("heroName", e.target.value)} placeholder="ex. Professeure Fossile" /></Field>
          <Field label="Apparence du personnage"><Input value={plan.heroDescription} onChange={(e) => set("heroDescription", e.target.value)} placeholder="ex. cheveux gris bouclés, chapeau d'exploratrice" /></Field>
          <Field label="Compagnon"><Input value={plan.companion} onChange={(e) => set("companion", e.target.value)} placeholder="ex. Pépite, bébé tricératops" /></Field>
          <Field label="Lieu ou véhicule"><Input value={plan.place} onChange={(e) => set("place", e.target.value)} placeholder="ex. camion-laboratoire « Le Fouineur »" /></Field>
        </>
      )}
      <Field label={`Nombre ${/^[aeiouyéèêh]/i.test(def.countLabel) ? "d'" : "de "}${def.countLabel}`} hint={plan.count > 20 ? `Rédaction par lots de 15 (sommaire puis lots) · maximum ${MAX_ITEMS_PER_BOOK}` : undefined}><Input type="number" min={1} max={MAX_ITEMS_PER_BOOK} value={plan.count} onChange={(e) => set("count", Math.max(1, Math.min(MAX_ITEMS_PER_BOOK, Number(e.target.value) || 1)))} /></Field>
      <Field label="Prix boutique (€ TTC)"><Input type="number" min={0} step={0.1} value={((plan.priceCents ?? def.defaultPriceCents) / 100).toFixed(2)} onChange={(e) => set("priceCents", Math.round(Number(e.target.value) * 100))} /></Field>
      <Field label="Catégorie boutique">
        <Select value={plan.shopCategorySlug ?? def.shopCategory} onChange={(e) => set("shopCategorySlug", e.target.value)}>{(cats.some((c) => c.slug === (plan.shopCategorySlug ?? def.shopCategory)) ? cats : [{ slug: plan.shopCategorySlug ?? def.shopCategory, name: plan.shopCategorySlug ?? def.shopCategory }, ...cats]).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select>
      </Field>
      {coloring && <ColoringPlanOptions plan={plan} onChange={onChange} ai={coloringAi} />}
      <Field label="Consignes pour l'auteur" className="md:col-span-2" hint="Transmises à l'IA lors de la rédaction du contenu.">
        <Textarea rows={4} value={plan.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}
