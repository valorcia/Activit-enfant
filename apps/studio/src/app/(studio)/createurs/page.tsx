import Link from "next/link";
import { ExternalLink, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CreateEbookButton } from "@/components/creators/create-ebook-button";
import { prisma } from "@/lib/db";
import { getShopSettings } from "@/lib/settings";
import { ShopApiError, ShopClient, type ShopCreatorSubmission } from "@/lib/shop/client";
import { CREATOR_KIT_TYPES } from "@/lib/creators/brief";
import { activeSites } from "@/lib/universes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Idées des créatrices" };

const STATUS: Record<ShopCreatorSubmission["status"], { label: string; variant: "success" | "warning" | "secondary" | "default" | "purple" }> = {
  ACCEPTED: { label: "Acceptée — à fabriquer", variant: "default" },
  IN_PRODUCTION: { label: "En fabrication", variant: "purple" },
  PREVIEW_READY: { label: "Aperçu envoyé", variant: "warning" },
  APPROVED: { label: "Validée par la créatrice", variant: "success" },
  PUBLISHED: { label: "En vente", variant: "success" },
};

async function load(): Promise<{ items: ShopCreatorSubmission[]; error: string | null; configured: boolean }> {
  const shop = await getShopSettings();
  if (!shop.shopApiUrl || !shop.shopApiKey) return { items: [], error: null, configured: false };
  try {
    const items = await new ShopClient({ baseUrl: shop.shopApiUrl, apiKey: shop.shopApiKey }).creatorSubmissions("all");
    return { items, error: null, configured: true };
  } catch (e) {
    const msg = e instanceof ShopApiError && e.status === 403 ? "La clé API de la boutique n'a pas les scopes creators:read / creators:write : créez une nouvelle clé avec ces scopes dans l'admin de la boutique (API & automatisation) puis collez-la dans Paramètres → Boutique." : e instanceof Error ? e.message : String(e);
    return { items: [], error: msg, configured: true };
  }
}

export default async function CreatorIdeasPage() {
  const [{ items, error, configured }, sites] = await Promise.all([load(), activeSites()]);
  const order: ShopCreatorSubmission["status"][] = ["ACCEPTED", "IN_PRODUCTION", "PREVIEW_READY", "APPROVED", "PUBLISHED"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const bookIds = items.map((i) => i.studioBookId).filter((x): x is string => !!x);
  const books = bookIds.length ? await prisma.book.findMany({ where: { id: { in: bookIds } }, select: { id: true } }) : [];
  return (
    <div className="max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Idées des créatrices" description="Idées acceptées dans l'Espace créatrices de la boutique. « Créer l'e-book » lance le pilote automatique avec un brief tiré de la proposition et le crédit « Une idée de … » ; l'aperçu est ensuite envoyé à la créatrice pour validation avant la mise en vente." />
      {!configured && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">La boutique n&apos;est pas reliée : renseignez son URL et une clé API dans <Link href="/settings" className="font-semibold underline">Paramètres → Boutique</Link>.</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>}
      {configured && !error && sorted.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500"><Lightbulb className="mx-auto mb-2 h-8 w-8" />Aucune idée acceptée pour l&apos;instant. Les idées sont modérées dans l&apos;admin de la boutique (Créatrices → Modération).</div>
      )}
      <ul className="grid gap-4">
        {sorted.map((s) => (
          <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex gap-2 overflow-x-auto">
                {s.photos.slice(0, 4).map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1} de la créatrice`} className="h-full w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{s.title}</span>
                  <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
                  {s.exclusive && <Badge variant="secondary">Exclusivité</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{s.credit} · {s.ageMin ?? "?"}–{s.ageMax ?? "?"} ans{s.durationMinutes ? ` · ${s.durationMinutes} min` : ""} · {s.contribution === "FULL_TUTORIAL" ? "tutoriel complet" : "idée + photos"} · {s.photos.length} photo(s)</p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold text-slate-700">Matériel et étapes</summary>
                  <p className="mt-2 text-slate-600"><b>Matériel :</b> {s.materials.join(", ") || "—"}</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-600">{s.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
                  {s.tips && <p className="mt-1 text-slate-600"><b>Astuces :</b> {s.tips}</p>}
                  <p className="mt-1 text-slate-600"><b>Sécurité :</b> {s.safetyNotes || "—"}</p>
                </details>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {s.studioBookId && books.some((b) => b.id === s.studioBookId) && <Link href={`/books/${s.studioBookId}`} className="font-semibold text-blue-700 hover:underline">Livre dans le studio</Link>}
                  {s.previewUrl && <a href={s.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline">Aperçu envoyé <ExternalLink className="h-3 w-3" /></a>}
                </div>
              </div>
            </div>
            {(s.status === "ACCEPTED" || s.status === "IN_PRODUCTION") && (
              <div className="mt-3"><CreateEbookButton submissionId={s.id} kitTypes={[...CREATOR_KIT_TYPES]} sites={sites.map((x) => ({ slug: x.slug, name: x.name }))} defaultPriceCents={390} /></div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-500">Les photos sont servies par la boutique via des liens signés valables une heure ; rechargez la page si elles ne s&apos;affichent plus.</p>
    </div>
  );
}
