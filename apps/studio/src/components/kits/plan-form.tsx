"use client";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { KIT_AGE_RANGES, KIT_TYPES, TONES, UNIVERSES, kitType } from "@/lib/kits/types";
import { ageRangeLabel } from "@/lib/schemas/activity";
import type { KitPlan } from "@/lib/kits/schemas";

export const SHOP_CATEGORIES = [
  { slug: "chasses-au-tresor", name: "Chasses au trésor" },
  { slug: "activites-educatives", name: "Activités éducatives" },
  { slug: "evenements", name: "Événements" },
  { slug: "histoires-et-aventures", name: "Histoires et aventures" },
];

/** Formulaire de plan de kit (aperçu éditable après analyse d'un brief, ou personnalisation). */
export function KitPlanForm({ plan, onChange, categories }: { plan: KitPlan; onChange: (p: KitPlan) => void; categories?: Array<{ slug: string; name: string }> }) {
  const set = <K extends keyof KitPlan>(k: K, v: KitPlan[K]) => onChange({ ...plan, [k]: v });
  const def = kitType(plan.kitType);
  const cats = categories?.length ? categories : SHOP_CATEGORIES;
  const ages = Array.from(new Set([...KIT_AGE_RANGES, plan.ageRange]));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Type de kit">
        <Select value={plan.kitType} onChange={(e) => { const d = kitType(e.target.value); onChange({ ...plan, kitType: d.key, count: d.defaultCount, shopCategorySlug: d.shopCategory, priceCents: plan.priceCents ?? d.defaultPriceCents }); }}>
          {KIT_TYPES.map((k) => <option key={k.key} value={k.key}>{k.label}{k.family === "activites" ? " (livre d'activités)" : ""}</option>)}
        </Select>
      </Field>
      <Field label="Tranche d'âge">
        <Select value={plan.ageRange} onChange={(e) => set("ageRange", e.target.value)}>{ages.map((a) => <option key={a} value={a}>{ageRangeLabel(a)}</option>)}</Select>
      </Field>
      <Field label="Titre"><Input value={plan.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <Field label="Sous-titre (bénéfice principal)"><Input value={plan.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
      <Field label="Univers" hint="Choisissez ou saisissez librement.">
        <Input list="kit-universes" value={plan.universe} onChange={(e) => set("universe", e.target.value)} />
        <datalist id="kit-universes">{UNIVERSES.map((u) => <option key={u} value={u} />)}</datalist>
      </Field>
      <Field label="Ton">
        <Input list="kit-tones" value={plan.tone} onChange={(e) => set("tone", e.target.value)} />
        <datalist id="kit-tones">{TONES.map((u) => <option key={u} value={u} />)}</datalist>
      </Field>
      <Field label="Personnage principal"><Input value={plan.heroName} onChange={(e) => set("heroName", e.target.value)} placeholder="ex. Professeure Fossile" /></Field>
      <Field label="Apparence du personnage"><Input value={plan.heroDescription} onChange={(e) => set("heroDescription", e.target.value)} placeholder="ex. cheveux gris bouclés, chapeau d'exploratrice" /></Field>
      <Field label="Compagnon"><Input value={plan.companion} onChange={(e) => set("companion", e.target.value)} placeholder="ex. Pépite, bébé tricératops" /></Field>
      <Field label="Lieu ou véhicule"><Input value={plan.place} onChange={(e) => set("place", e.target.value)} placeholder="ex. camion-laboratoire « Le Fouineur »" /></Field>
      <Field label={`Nombre d'${def.countLabel}`}><Input type="number" min={1} max={60} value={plan.count} onChange={(e) => set("count", Math.max(1, Math.min(60, Number(e.target.value) || 1)))} /></Field>
      <Field label="Prix boutique (€ TTC)"><Input type="number" min={0} step={0.1} value={((plan.priceCents ?? def.defaultPriceCents) / 100).toFixed(2)} onChange={(e) => set("priceCents", Math.round(Number(e.target.value) * 100))} /></Field>
      <Field label="Catégorie boutique">
        <Select value={plan.shopCategorySlug ?? def.shopCategory} onChange={(e) => set("shopCategorySlug", e.target.value)}>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select>
      </Field>
      <Field label="Consignes pour l'auteur" className="md:col-span-2" hint="Transmises à l'IA lors de la rédaction du contenu.">
        <Textarea rows={4} value={plan.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}
