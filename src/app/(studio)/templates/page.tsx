import { PageHeader } from "@/components/page-header";
import { BUILTIN_TEMPLATES } from "@/lib/layout/themes";
import { PAGE_TEMPLATES } from "@/lib/schemas/layout";
import { ThemePreview } from "@/components/theme-preview";

export default function TemplatesPage() {
  return (
    <div className="p-8 max-w-6xl">
      <PageHeader title="Modèles graphiques" description="Thèmes de mise en page (couleurs, typographies) et bibliothèque de modèles de pages. Le thème se choisit par livre, dans l'onglet Mise en page." />
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {BUILTIN_TEMPLATES.map((t) => (
          <div key={t.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <ThemePreview theme={t.theme} />
            <div className="mt-3 font-bold">{t.name}</div>
            <div className="text-xs text-slate-500">{t.description}</div>
            <div className="text-xs text-slate-500 mt-1">Titres : {t.theme.fontHeading} · Texte : {t.theme.fontBody}</div>
          </div>
        ))}
      </div>
      <h2 className="font-bold text-lg mb-3">Modèles de pages</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PAGE_TEMPLATES.map((p) => (
          <div key={p.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-slate-500">{p.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
