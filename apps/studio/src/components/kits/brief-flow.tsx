"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, ExternalLink, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { JobProgress } from "@/components/job-progress";
import { analyzeBriefAction, createKitFromPlanAction, type BriefAnalysis } from "@/app/actions/kits";
import { kitType } from "@/lib/kits/types";
import type { KitPlan } from "@/lib/kits/schemas";
import { KitPlanForm } from "./plan-form";
import { AutopilotLaunch } from "@/components/autopilot/launch-panel";
import { UniverseSelect } from "@/components/universes/universe-select";
import type { Site } from "@/lib/universes/sites";

const EXAMPLE = "Fais-moi une chasse au trésor sur les dinosaures pour les 5-8 ans, avec une paléontologue rigolote et un bébé tricératops qui donne les indices. 10 énigmes dans la maison, prix 9,90 €.";

/** Brief libre (ou JSON complet) collé → plan éditable → création du kit et lancement de la production. */
export function BriefFlow({ mode, categories, sites = [], sitesNote }: { mode: "api" | "manual"; categories?: Array<{ slug: string; name: string }>; sites?: Site[]; sitesNote?: string | null }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [siteSlug, setSiteSlug] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BriefAnalysis | null>(null);
  const [plan, setPlan] = useState<KitPlan | null>(null);
  const [start, setStart] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, run] = useTransition();

  const analyze = () =>
    run(async () => {
      setError(null);
      setCopied(false);
      const r = await analyzeBriefAction(text, siteSlug);
      setAnalysis(r);
      if (r.kind === "plan") setPlan(r.plan);
      if (r.kind === "error") setError(r.error);
    });

  const create = () =>
    run(async () => {
      if (!plan) return;
      setError(null);
      try {
        const r = await createKitFromPlanAction({ plan, brief: text, contentJson: analysis?.kind === "plan" ? analysis.contentJson : undefined, startProduction: start && kitType(plan.kitType).family === "kit" });
        setBookId(r.bookId);
        if (r.jobId) setJobId(r.jobId);
        else router.push(`/books/${r.bookId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <label htmlFor="brief" className="block font-bold">Votre brief</label>
        <p className="text-sm text-slate-500">
          Collez une demande libre (comme à Claude), un prompt complet de <code>docs/prompts</code>, ou directement le JSON obtenu avec ce prompt : le studio reconnaît le contenu complet et l&apos;importe sans nouvel appel IA.
        </p>
        <Textarea id="brief" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} className="font-mono text-sm" />
        {sites.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="brief-site" className="text-sm font-semibold">Univers de la boutique</label>
            <div className="min-w-72"><UniverseSelect id="brief-site" sites={sites} value={siteSlug} onChange={setSiteSlug} allowAuto /></div>
            {sitesNote && <span className="text-xs text-slate-500">{sitesNote}</span>}
          </div>
        )}
        <AutopilotLaunch text={text} siteSlug={siteSlug} />
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={analyze} disabled={pending || text.trim().length < 10}><Wand2 className="h-4 w-4" /> {pending && !plan ? "Analyse…" : "Analyser le brief (étape par étape)"}</Button>
          <span className="text-xs text-slate-500">Mode actuel : {mode === "manual" ? "copier-coller (aucune clé API)" : "API"}</span>
        </div>
      </div>

      {analysis?.kind === "prompt" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 space-y-3">
          <p className="text-sm font-semibold text-blue-900">{analysis.message}</p>
          <Textarea readOnly rows={8} value={analysis.prompt} className="font-mono text-xs bg-white" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(analysis.prompt).then(() => setCopied(true)); }}><ClipboardCopy className="h-4 w-4" /> {copied ? "Copié !" : "Copier le prompt"}</Button>
            <Button asChild variant="secondary"><a href="https://claude.ai/new" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ouvrir Claude</a></Button>
            <Button asChild variant="secondary"><a href="https://chatgpt.com/" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ouvrir ChatGPT</a></Button>
          </div>
        </div>
      )}

      {plan && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">Plan de l&apos;e-book</h2>
            {analysis?.kind === "plan" && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                {analysis.source === "contenu" ? "Contenu complet reconnu : il sera importé tel quel" : analysis.source === "json" ? "Plan JSON importé" : "Plan proposé par l'IA"}
              </span>
            )}
          </div>
          <KitPlanForm plan={plan} onChange={setPlan} categories={categories} sites={sites} />
          {kitType(plan.kitType).family === "kit" ? (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4" checked={start} onChange={(e) => setStart(e.target.checked)} />
              Lancer la production complète (contenu, illustrations, couverture, pages)
            </label>
          ) : (
            <p className="text-sm text-slate-500">Livre d&apos;activités : le sommaire sera proposé, vous le validerez avant la production.</p>
          )}
          <Button size="lg" onClick={create} disabled={pending || Boolean(jobId)}>Créer le kit{start && kitType(plan.kitType).family === "kit" ? " et lancer la production" : ""}</Button>
          {jobId && bookId && <JobProgress jobId={jobId} title="Production" onDone={() => router.push(`/books/${bookId}?tab=kit`)} />}
          {jobId && bookId && <Button variant="link" onClick={() => router.push(`/books/${bookId}?tab=kit`)}>Ouvrir le kit</Button>}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
