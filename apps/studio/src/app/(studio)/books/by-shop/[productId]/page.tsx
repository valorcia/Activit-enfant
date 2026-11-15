import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lien depuis la boutique : ouvre le livre qui a produit ce produit. */
export default async function BookByShopProduct({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const book = await prisma.book.findFirst({ where: { shopProductId: productId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  if (book) redirect(`/books/${book.id}`);
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-black">Produit non lié au studio</h1>
      <p className="mt-2 text-sm text-slate-600">
        Ce produit de la boutique n'a pas été publié depuis le studio (création directe dans l'administration, import CSV ou produit de démonstration).
        Pour le relier, ouvrez le livre correspondant dans le studio et utilisez l'onglet « Boutique ».
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/books" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Voir les livres</Link>
        <Link href="/shop" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">Catalogue de la boutique</Link>
      </div>
    </div>
  );
}
