"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createEbookFromSubmissionAction } from "@/app/actions/creators";

export function CreateEbookButton({ submissionId, kitTypes, sites, defaultPriceCents }: { submissionId: string; kitTypes: Array<{ key: string; label: string }>; sites: Array<{ slug: string; name: string }>; defaultPriceCents: number }) {
  const router = useRouter();
  const [kitType, setKitType] = useState(kitTypes[0]?.key ?? "");
  const [count, setCount] = useState("1");
  const [price, setPrice] = useState(String(defaultPriceCents / 100).replace(".", ","));
  const [siteSlug, setSiteSlug] = useState(sites[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Format
          <Select value={kitType} onChange={(e) => setKitType(e.target.value)} className="mt-1">{kitTypes.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Fiches
          <Input type="number" min={1} max={30} value={count} onChange={(e) => setCount(e.target.value)} className="mt-1" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Prix (€)
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
        </label>
        {sites.length > 1 && (
          <label className="text-xs font-semibold text-slate-600 sm:col-span-4">Univers
            <Select value={siteSlug} onChange={(e) => setSiteSlug(e.target.value)} className="mt-1">{sites.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</Select>
          </label>
        )}
      </div>
      <Button disabled={pending} className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto" onClick={() => start(async () => {
        setError(null);
        const r = await createEbookFromSubmissionAction(submissionId, { kitType, count: Number(count) || 1, priceCents: Math.round(Number(price.replace(",", ".")) * 100) || undefined, siteSlug: siteSlug || null });
        if (r.ok) router.push(`/autopilot/${r.data.runId}`);
        else setError(r.error);
      })}><Rocket className="h-4 w-4" /> {pending ? "Lancement…" : "Créer l'e-book"}</Button>
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}
