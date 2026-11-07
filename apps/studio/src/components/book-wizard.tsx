"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { JobProgress } from "@/components/job-progress";
import { createBook } from "@/app/actions/books";
import { AGE_RANGES, ART_STYLES, BOOK_TYPES, PAGE_FORMATS, ACTIVITY_COUNTS, ageRangeLabel } from "@/lib/schemas/activity";
import { cn, formatUsd } from "@/lib/utils";

const STEPS = ["Type de livre", "Âge", "Nombre d'activités", "Style graphique", "Format", "Sommaire"];

export function BookWizard({ perActivityCost, textProvider }: { perActivityCost: number; textProvider: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [bookType, setBookType] = useState<string>("inventions");
  const [ageRange, setAgeRange] = useState<string>("6-9");
  const [count, setCount] = useState<number>(10);
  const [custom, setCustom] = useState<string>("");
  const [artStyle, setArtStyle] = useState<string>("aquarelle");
  const [pageFormat, setPageFormat] = useState<string>("A4_PORTRAIT");
  const [customW, setCustomW] = useState(210);
  const [customH, setCustomH] = useState(297);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [collection, setCollection] = useState("Inventor Studio");
  const [brief, setBrief] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const effectiveCount = custom ? Number(custom) : count;

  const Option = ({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc?: string }) => (
    <button type="button" onClick={onClick} className={cn("text-left rounded-xl border p-4 hover:border-blue-400 transition-colors", active ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200" : "border-slate-200 bg-white")}>
      <div className="font-bold">{title}</div>
      {desc && <div className="text-xs text-slate-500 mt-1">{desc}</div>}
    </button>
  );

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("rounded-full px-3 py-1 font-semibold", i === step ? "bg-blue-600 text-white" : i < step ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500")}>{i + 1}. {s}</li>
        ))}
      </ol>

      <div className="rounded-xl border border-slate-200 bg-white p-6 min-h-[320px]">
        {step === 0 && (
          <div className="grid md:grid-cols-3 gap-3">
            {BOOK_TYPES.map((t) => <Option key={t.key} active={bookType === t.key} onClick={() => setBookType(t.key)} title={t.label} />)}
          </div>
        )}
        {step === 1 && (
          <div className="grid md:grid-cols-4 gap-3">
            {AGE_RANGES.map((a) => <Option key={a} active={ageRange === a} onClick={() => setAgeRange(a)} title={ageRangeLabel(a)} />)}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {ACTIVITY_COUNTS.map((c) => <Option key={c} active={!custom && count === c} onClick={() => { setCount(c); setCustom(""); }} title={String(c)} />)}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold mb-1">Personnalisé</div>
                <Input type="number" min={1} max={365} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ex. 365" />
              </div>
            </div>
            <p className="text-sm text-slate-500">Estimation : {formatUsd(perActivityCost * effectiveCount)} de génération IA (textes + illustrations) avec les paramètres actuels{textProvider === "mock" ? " — mode démonstration hors ligne, coût nul" : ""}.</p>
          </div>
        )}
        {step === 3 && (
          <div className="grid md:grid-cols-3 gap-3">
            {ART_STYLES.map((s) => <Option key={s.key} active={artStyle === s.key} onClick={() => setArtStyle(s.key)} title={s.label} desc={s.prompt} />)}
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              {Object.entries(PAGE_FORMATS).map(([k, f]) => <Option key={k} active={pageFormat === k} onClick={() => setPageFormat(k)} title={f.label} desc={k !== "CUSTOM" ? `${f.widthMm} × ${f.heightMm} mm` : undefined} />)}
            </div>
            {pageFormat === "CUSTOM" && (
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <Field label="Largeur (mm)"><Input type="number" value={customW} onChange={(e) => setCustomW(Number(e.target.value))} /></Field>
                <Field label="Hauteur (mm)"><Input type="number" value={customH} onChange={(e) => setCustomH(Number(e.target.value))} /></Field>
              </div>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Titre du livre" hint="Laissez vide pour laisser l'IA proposer un titre."><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Les Petits Inventeurs" /></Field>
              <Field label="Sous-titre"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="10 inventions extraordinaires" /></Field>
              <Field label="Collection"><Input value={collection} onChange={(e) => setCollection(e.target.value)} /></Field>
            </div>
            <Field label="Demande détaillée (facultatif)" hint="Ex. : « Crée un livre de 30 activités scientifiques pour enfants de 6 à 9 ans, avec des illustrations détaillées et une mise en page professionnelle. »">
              <Textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} />
            </Field>
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <div className="font-semibold mb-1">Récapitulatif</div>
              {BOOK_TYPES.find((t) => t.key === bookType)?.label} · {ageRangeLabel(ageRange)} · {effectiveCount} activités · {ART_STYLES.find((s) => s.key === artStyle)?.label} · {PAGE_FORMATS[pageFormat as keyof typeof PAGE_FORMATS].label}
            </div>
            {jobId && bookId && (
              <JobProgress jobId={jobId} title="Génération du sommaire" onDone={() => router.push(`/books/${bookId}?tab=outline`)} />
            )}
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" disabled={step === 0 || Boolean(jobId)} onClick={() => setStep((s) => s - 1)}>Précédent</Button>
        {step < 5 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 2 && (!effectiveCount || effectiveCount < 1)}>Suivant</Button>
        ) : (
          <Button
            disabled={pending || Boolean(jobId)}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  const r = await createBook({ title: title || "Nouveau livre", subtitle: subtitle || undefined, collection: collection || undefined, bookType, ageRange: ageRange as "6-9", targetCount: effectiveCount, artStyle, pageFormat, customWidthMm: pageFormat === "CUSTOM" ? customW : undefined, customHeightMm: pageFormat === "CUSTOM" ? customH : undefined, brief: brief || undefined });
                  setBookId(r.bookId);
                  setJobId(r.jobId);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              })
            }
          >
            Générer le sommaire
          </Button>
        )}
      </div>
    </div>
  );
}
