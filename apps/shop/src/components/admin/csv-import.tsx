"use client";
import { useState, useTransition } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { previewCsvAction, runImportAction, type CsvPreview } from "@/app/actions/admin/import";

export function CsvImport() {
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number; errors: Array<{ line: number; name?: string; error: string }> } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-heading text-lg font-bold">1. Préparer le fichier</h2>
        <p className="mt-1 text-sm text-ink-soft">Téléchargez le modèle, remplissez une ligne par produit (UTF-8, séparateur virgule ou point-virgule). Colonnes obligatoires : <code>name</code>, <code>price</code> (en euros). Un produit existant avec le même <code>slug</code> est mis à jour. Les images (<code>main_image_url</code>, <code>gallery_urls</code> séparées par |) sont téléchargées automatiquement. Les fichiers PDF payants s&apos;ajoutent ensuite depuis chaque fiche.</p>
        <Button asChild variant="outline" size="sm" className="mt-3"><a href="/api/admin/import/template"><Download className="size-4" /> Télécharger le modèle CSV</a></Button>
      </div>

      <form className="rounded-2xl border border-line bg-white p-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { setResult(null); const r = await previewCsvAction(fd); if (!r.ok) { toast.error(r.error); setPreview(null); } else setPreview(r.data); }); }}>
        <h2 className="font-heading text-lg font-bold">2. Charger et prévisualiser</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".csv,text/csv" required className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-bold file:text-white" />
          <Button type="submit" variant="soft" size="sm" disabled={pending}><FileSpreadsheet className="size-4" /> {pending ? "Analyse…" : "Prévisualiser"}</Button>
        </div>
      </form>

      {preview && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-heading text-lg font-bold">3. Vérifier puis importer</h2>
          <p className="mt-1 text-sm text-ink-soft">{preview.fileName} · {preview.total} ligne{preview.total > 1 ? "s" : ""} · <span className="text-sage-dark font-semibold">{preview.valid} valide{preview.valid > 1 ? "s" : ""}</span>{preview.invalid > 0 && <> · <span className="font-semibold text-red-600">{preview.invalid} en erreur (ignorées)</span></>}</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-[#F6F3EE] text-left text-xs uppercase text-ink-muted"><tr><th className="px-3 py-2">Ligne</th><th className="px-3 py-2">Nom</th><th className="px-3 py-2">Prix</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Erreurs</th></tr></thead>
              <tbody className="divide-y divide-line">
                {preview.sample.map((r) => (
                  <tr key={r.line} className={r.errors.length ? "bg-red-50" : ""}>
                    <td className="px-3 py-2 text-ink-muted">{r.line}</td><td className="px-3 py-2 font-semibold">{r.name}</td><td className="px-3 py-2">{r.price}</td><td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-xs text-red-700">{r.errors.join(" ; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > 10 && <p className="mt-2 text-xs text-ink-muted">Aperçu limité aux 10 premières lignes.</p>}
          <Button variant="admin" size="sm" className="mt-4" disabled={pending || preview.valid === 0} onClick={() => start(async () => {
            const r = await runImportAction(preview.text, preview.fileName);
            if (!r.ok) { toast.error(r.error); return; }
            setResult(r.data); setPreview(null);
            toast.success(`Import terminé : ${r.data.created} créé(s), ${r.data.updated} mis à jour`);
          })}><Upload className="size-4" /> {pending ? "Import en cours…" : `Importer ${preview.valid} produit${preview.valid > 1 ? "s" : ""}`}</Button>
        </div>
      )}

      {result && (
        <Alert variant={result.failed ? "warning" : "success"} title="Import terminé">
          <p>{result.created} créé(s) · {result.updated} mis à jour · {result.failed} en échec.</p>
          {result.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{result.errors.map((e, i) => <li key={i}>Ligne {e.line}{e.name ? ` (${e.name})` : ""} : {e.error}</li>)}</ul>}
        </Alert>
      )}
    </div>
  );
}
