"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobProgress } from "@/components/job-progress";
import { createKitBook } from "@/app/actions/kits";
import { ART_STYLES, PAGE_FORMATS, ageRangeLabel } from "@/lib/schemas/activity";
import { KIT_TYPES, kitType } from "@/lib/kits/types";
import { KitPlanSchema, type KitPlan } from "@/lib/kits/schemas";
import { cn } from "@/lib/utils";
import { KitIcon } from "./kit-icon";
import { KitPlanForm } from "./plan-form";

const STEPS = ["Type de kit", "Personnalisation", "Style et format", "Récapitulatif"];

function planFor(key: string, prices: Record<string, number>): KitPlan {
  const d = kitType(key);
  return KitPlanSchema.parse({ kitType: d.key, title: "", ageRange: d.defaultAge, universe: d.defaultUniverse ?? "", count: d.defaultCount, priceCents: prices[d.key] ?? d.defaultPriceCents, shopCategorySlug: d.shopCategory, tone: "Joyeux et complice" });
}

/** Assistant de création : type de kit, personnalisation, style et format, puis production. */
export function KitWizard({ categories, prices = {} }: { categories?: Array<{ slug: string; name: string }>; prices?: Record<string, number> }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<KitPlan>(planFor("chasse-au-tresor", prices));
  const [artStyle, setArtStyle] = useState("aquarelle");
  const [pageFormat, setPageFormat] = useState("A4_PORTRAIT");
  const [startNow, setStartNow] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const def = kitType(plan.kitType);
  const kits = KIT_TYPES.filter((k) => k.family === "kit" || ["cahier-activites", "jeux-logique", "activites-montessori", "histoire-illustree", "histoire-du-soir", "livre-personnalisable"].includes(k.key));
  const legacy = KIT_TYPES.filter((k) => !kits.includes(k));

  const create = () =>
    start(async () => {
      setError(null);
      try {
        const r = await createKitBook(
          {
            kitType: plan.kitType,
            title: plan.title || def.label,
            subtitle: plan.subtitle || undefined,
            ageRange: plan.ageRange,
            artStyle,
            pageFormat,
            brief: plan.notes || undefined,
            customization: { universe: plan.universe, heroName: plan.heroName, heroDescription: plan.heroDescription, companion: plan.companion, place: plan.place, tone: plan.tone, count: plan.count, priceCents: plan.priceCents, shopCategorySlug: plan.shopCategorySlug, extraInstructions: plan.notes },
          },
          { startProduction: startNow && def.family === "kit" },
        );
        setBookId(r.bookId);
        setJobId(r.jobId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  const Card = ({ k }: { k: (typeof KIT_TYPES)[number] }) => (
    <button type="button" onClick={() => setPlan({ ...planFor(k.key, prices), title: plan.title, heroName: plan.heroName, companion: plan.companion })} className={cn("text-left rounded-xl border p-4 transition-colors hover:border-blue-400", plan.kitType === k.key ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-white")}>
      <div className="flex items-center gap-2 font-bold"><KitIcon name={k.icon} className="h-5 w-5 text-blue-700" /> {k.label}</div>
      <div className="mt-1 text-xs text-slate-500">{k.description}</div>
      <div className="mt-2 text-[11px] text-slate-400">{ageRangeLabel(k.defaultAge)} · {k.defaultCount} {k.countLabel} · {(k.defaultPriceCents / 100).toFixed(2).replace(".", ",")} €</div>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => <li key={s} className={cn("rounded-full px-3 py-1 font-semibold", i === step ? "bg-blue-600 text-white" : i < step ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500")}>{i + 1}. {s}</li>)}
        </ol>
        <Button asChild variant="secondary" size="sm"><Link href="/brief"><Wand2 className="h-4 w-4" /> Créer depuis un brief</Link></Button>
      </div>

      <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">{kits.map((k) => <Card key={k.key} k={k} />)}</div>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-slate-600">Livres d&apos;activités historiques (inventions, sciences…)</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">{legacy.map((k) => <Card key={k.key} k={k} />)}</div>
            </details>
          </div>
        )}
        {step === 1 && <KitPlanForm plan={plan} onChange={setPlan} categories={categories} />}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {ART_STYLES.map((s) => (
                <button key={s.key} type="button" onClick={() => setArtStyle(s.key)} className={cn("rounded-xl border p-4 text-left", artStyle === s.key ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200")}>
                  <div className="font-bold">{s.label}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(PAGE_FORMATS).filter(([k]) => k !== "CUSTOM").map(([k, f]) => (
                <button key={k} type="button" onClick={() => setPageFormat(k)} className={cn("rounded-xl border p-4 text-left", pageFormat === k ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200")}>
                  <div className="font-bold">{f.label}</div>
                  <div className="text-xs text-slate-500">{f.widthMm} × {f.heightMm} mm</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">La charte d&apos;illustration (Paramètres → Studio) est ajoutée à tous les prompts d&apos;images.</p>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed">
              <div className="mb-1 font-bold">{plan.title || def.label}</div>
              {def.label} · {ageRangeLabel(plan.ageRange)} · {plan.count} {def.countLabel} · {plan.universe || "univers libre"}
              {plan.heroName ? ` · personnage : ${plan.heroName}` : ""}{plan.companion ? ` · compagnon : ${plan.companion}` : ""}
              <br />Prix : {((plan.priceCents ?? def.defaultPriceCents) / 100).toFixed(2).replace(".", ",")} € · {ART_STYLES.find((s) => s.key === artStyle)?.label} · {PAGE_FORMATS[pageFormat as keyof typeof PAGE_FORMATS].label}
              <div className="mt-2 text-xs text-slate-500">Structure : {def.sections.map((s) => s.label).join(" · ")}</div>
            </div>
            {def.family === "kit" ? (
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} /> Lancer toute la production maintenant (sinon : rédaction du contenu seulement)</label>
            ) : (
              <p className="text-sm text-slate-500">Le sommaire sera proposé, vous le validerez avant la production.</p>
            )}
            {jobId && bookId && <JobProgress jobId={jobId} title={def.family === "kit" ? "Production du kit" : "Génération du sommaire"} onDone={() => router.push(`/books/${bookId}?tab=${def.family === "kit" ? "kit" : "outline"}`)} />}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" disabled={step === 0 || Boolean(jobId)} onClick={() => setStep((s) => s - 1)}>Précédent</Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !plan.title.trim()}>Suivant</Button>
        ) : (
          <Button disabled={pending || Boolean(jobId)} onClick={create}>{def.family === "kit" ? (startNow ? "Créer et produire" : "Créer et rédiger le contenu") : "Générer le sommaire"}</Button>
        )}
      </div>
      {step === 1 && !plan.title.trim() && <p className="text-right text-xs text-slate-500">Donnez un titre pour continuer.</p>}
    </div>
  );
}
