"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { duplicateProductAction, setStatusAction, deleteProductAction } from "@/app/actions/admin/products";

export function ProductRowActions({ id, slug, status }: { id: string; slug: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    const r = await fn();
    if (!r.ok) toast.error(r.error ?? "Erreur"); else { toast.success(ok); router.refresh(); }
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Actions" disabled={pending}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><Link href={`/admin/produits/${id}`}>Modifier</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`/aventures/${slug}`} target="_blank">Voir la fiche</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => start(async () => { const r = await duplicateProductAction(id); if (!r.ok) toast.error(r.error); else router.push(`/admin/produits/${r.data.id}`); })}>Dupliquer</DropdownMenuItem>
        <DropdownMenuSeparator />
        {status !== "PUBLISHED" && <DropdownMenuItem onSelect={() => run(() => setStatusAction(id, "PUBLISHED"), "Produit publié")}>Publier</DropdownMenuItem>}
        {status === "PUBLISHED" && <DropdownMenuItem onSelect={() => run(() => setStatusAction(id, "DRAFT"), "Produit dépublié")}>Dépublier</DropdownMenuItem>}
        {status !== "ARCHIVED" && <DropdownMenuItem onSelect={() => run(() => setStatusAction(id, "ARCHIVED"), "Produit archivé")}>Archiver</DropdownMenuItem>}
        <DropdownMenuItem destructive onSelect={() => { if (confirm("Supprimer ce produit ? (archivé s'il a déjà été vendu)")) run(() => deleteProductAction(id), "Produit supprimé ou archivé"); }}>Supprimer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
