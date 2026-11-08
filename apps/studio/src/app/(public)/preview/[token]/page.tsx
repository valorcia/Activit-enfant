import type { Metadata } from "next";
import { verifyPreviewToken } from "@/lib/preview/token";
import { loadBookPreview } from "@/lib/preview/data";
import { BookViewer } from "@/components/preview/book-viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aperçu du livre", robots: { index: false, follow: false } };

/** Aperçu partagé en lecture seule (lien signé valable 7 jours) : aucune action d'édition. */
export default async function SharedPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await verifyPreviewToken(decodeURIComponent(token));
  const data = v ? await loadBookPreview(v.bookId, { assetParam: decodeURIComponent(token) }) : null;
  if (!v || !data) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <h1 className="text-xl font-black">Lien d'aperçu invalide ou expiré</h1>
        <p className="mt-2 text-slate-600">Demandez un nouveau lien à la personne qui vous l'a envoyé.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-[1500px] p-3 sm:p-6">
      <p className="mb-2 text-xs text-slate-500">Aperçu en lecture seule · lien valable jusqu'au {v.expiresAt.toLocaleDateString("fr-FR")}</p>
      <BookViewer data={data} readOnly />
    </div>
  );
}
