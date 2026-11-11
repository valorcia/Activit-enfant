"use client";
import { Field, Input, Select } from "@/components/ui/input";
import type { KitPlan } from "@/lib/kits/schemas";
import { ColoringOptionsSchema } from "@/lib/kits/schemas";
import { coloringComplexity } from "@/lib/kits/coloring";
import { imageCost, IMAGE_MODELS } from "@/lib/ai/pricing";
import { GRID_LABELS } from "@/lib/coloring/sheet-prompt";

/** Réglages IA courants transmis par la page (aucune clé : seulement les choix et l'état du mode). */
export interface ColoringAiView {
  imageModel: string;
  imageQuality: "low" | "medium" | "high";
  coverModel: string;
  coverQuality: "low" | "medium" | "high";
  sketch: boolean;
  manualImagesNow: boolean;
  manualTextNow: boolean;
}

/** Coût des images par l'API d'un cahier de coloriage (dessins + exemple + 2 visuels + couverture). */
export function coloringEstimate(count: number, ai: Pick<ColoringAiView, "imageModel" | "imageQuality" | "coverModel" | "coverQuality">, sample = true) {
  const unit = imageCost(ai.imageModel, ai.imageQuality, "1024x1536");
  const cover = imageCost(ai.coverModel, ai.coverQuality, "1024x1024");
  const n = count + (sample ? 1 : 0) + 2;
  const total = n * unit + cover;
  return { n, unit, cover, total, label: `≈ ${n} images × ${unit.toFixed(3)} $ + couverture ${cover.toFixed(2)} $ = ${total.toFixed(2)} $` };
}

/** Options du cahier de coloriage dans le plan : mise en page, mode IA (mixte), modèle d'image, planches. */
export function ColoringPlanOptions({ plan, onChange, ai }: { plan: KitPlan; onChange: (p: KitPlan) => void; ai?: ColoringAiView }) {
  const o = ColoringOptionsSchema.parse(plan.coloring ?? {});
  const a = plan.ai ?? {};
  const setO = (patch: Partial<typeof o>) => onChange({ ...plan, coloring: { ...o, ...patch } });
  const setA = (patch: Partial<NonNullable<KitPlan["ai"]>>) => onChange({ ...plan, ai: { ...a, ...patch } });
  const cx = coloringComplexity(plan.ageRange);
  const eff = { imageModel: a.imageModel ?? ai?.imageModel ?? "gpt-image-1-mini", imageQuality: a.imageQuality ?? ai?.imageQuality ?? "medium", coverModel: a.coverModel ?? ai?.coverModel ?? "gpt-image-1", coverQuality: a.coverQuality ?? ai?.coverQuality ?? "high" };
  const est = coloringEstimate(plan.count, eff, o.sampleColored);
  const imagesManual = a.imagesVia ? a.imagesVia === "manual" : Boolean(ai?.manualImagesNow);
  const textManual = a.textVia ? a.textVia === "manual" : Boolean(ai?.manualTextNow);
  const mixed = textManual && !imagesManual;
  const toggle = (label: string, checked: boolean, onChecked: (v: boolean) => void, hint?: string) => (
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChecked(e.target.checked)} /> <span>{label}{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span></label>
  );
  return (
    <div className="md:col-span-2 grid gap-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4 md:grid-cols-2">
      <div className="md:col-span-2 text-sm font-bold">Cahier de coloriage · complexité : {cx.label} (trait {cx.strokeMm})</div>
      <div className="space-y-2">
        {toggle("Page d'exemple colorée", o.sampleColored, (v) => setO({ sampleColored: v }), "Le premier dessin mis en couleur, pour donner envie.")}
        {toggle("Prénom / ligne « Ce cahier appartient à » sur la couverture", o.nameOnCover, (v) => setO({ nameOnCover: v }))}
        {toggle("Sommaire des dessins", o.toc, (v) => setO({ toc: v }))}
        {toggle("Impression recto-verso (page blanche au dos de chaque dessin)", o.duplex, (v) => setO({ duplex: v }), "Les feutres ne traversent pas sur le dessin suivant ; double le nombre de pages.")}
      </div>
      <Field label="Prénom de l'enfant (facultatif)" hint="Vide : une ligne à compléter à la main.">
        <Input value={o.childName} maxLength={60} onChange={(e) => setO({ childName: e.target.value })} />
      </Field>

      <div className="md:col-span-2 rounded-lg bg-white p-3">
        <div className="text-sm font-semibold">Production</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={() => setA({ textVia: "manual", imagesVia: "api" })} className={`rounded-full px-3 py-1 ${mixed ? "bg-violet-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>Texte : copier-coller (abonnement Claude) · Images : API OpenAI</button>
          <button type="button" onClick={() => setA({ textVia: "api", imagesVia: "api" })} className={`rounded-full px-3 py-1 ${!textManual && !imagesManual ? "bg-violet-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>Tout par l&apos;API (aucune intervention)</button>
          <button type="button" onClick={() => setA({ imagesVia: "manual" })} className={`rounded-full px-3 py-1 ${imagesManual ? "bg-violet-600 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>Images : copier-coller dans ChatGPT (planches)</button>
          {(a.textVia || a.imagesVia) && <button type="button" onClick={() => onChange({ ...plan, ai: { ...a, textVia: undefined, imagesVia: undefined } })} className="rounded-full px-3 py-1 text-slate-500 hover:underline">Réglages généraux</button>}
        </div>
        <p className="mt-2 text-sm">
          {imagesManual ? <>Images en copier-coller : 0 $ d&apos;API, une demande « Lot d&apos;images » ({GRID_LABELS[(a.sheetGrid ?? 4) as 1 | 4 | 9]}) à coller dans ChatGPT. Par l&apos;API : <b>{est.label}</b>, aucune intervention.</> : <>Images par l&apos;API : <b>{est.label}</b> ({eff.imageModel}, {eff.imageQuality}, sans esquisse ; couverture {eff.coverModel} {eff.coverQuality}).</>}
        </p>
        {imagesManual && (
          <button type="button" onClick={() => setA({ imagesVia: "api" })} className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Générer les images par l&apos;API ({est.label.replace(/^.*= /, "≈ ")}, aucune intervention)
          </button>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Modèle des dessins"><Select value={eff.imageModel} onChange={(e) => setA({ imageModel: e.target.value })}>{IMAGE_MODELS.openai.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
          <Field label="Qualité des dessins"><Select value={eff.imageQuality} onChange={(e) => setA({ imageQuality: e.target.value as "low" | "medium" | "high" })}><option value="low">Basse</option><option value="medium">Moyenne (conseillée)</option><option value="high">Haute</option></Select></Field>
          <Field label="Couverture"><Select value={`${eff.coverModel}|${eff.coverQuality}`} onChange={(e) => { const [m, q] = e.target.value.split("|"); setA({ coverModel: m, coverQuality: q as "low" | "medium" | "high" }); }}>{IMAGE_MODELS.openai.flatMap((m) => (["medium", "high"] as const).map((q) => <option key={`${m.value}|${q}`} value={`${m.value}|${q}`}>{m.label} · {q === "high" ? "haute" : "moyenne"}</option>))}</Select></Field>
          <Field label="Dessins par planche (copier-coller)" hint={a.sheetGrid === 9 && /^3-/.test(plan.ageRange) ? "3×3 déconseillé pour les 3–5 ans" : undefined}><Select value={String(a.sheetGrid ?? 4)} onChange={(e) => setA({ sheetGrid: Number(e.target.value) as 1 | 4 | 9 })}>{([1, 4, 9] as const).map((g) => <option key={g} value={g}>{GRID_LABELS[g]}</option>)}</Select></Field>
        </div>
        {toggle("Esquisses d'abord (déconseillé : une esquisse coûte presque autant qu'un dessin au trait final)", a.sketch ?? ai?.sketch ?? false, (v) => setA({ sketch: v }))}
      </div>
    </div>
  );
}
