import Link from "next/link";
import { Lightbulb, PlusCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCreatorWithContract } from "@/lib/creators/session";
import { parsePhotos } from "@/lib/creators/submissions";
import { SubmissionStatusBadge } from "@/components/creator/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Mes idées" };

export default async function IdeasPage() {
  const creator = await requireCreatorWithContract();
  const subs = await prisma.creatorSubmission.findMany({ where: { creatorId: creator.id }, orderBy: { updatedAt: "desc" }, include: { product: { select: { name: true, slug: true, status: true } } } });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold">Mes idées</h1>
        <Button asChild><Link href="/espace-createur/idees/nouvelle"><PlusCircle className="size-5" /> Proposer une idée</Link></Button>
      </div>
      {subs.length === 0 ? (
        <div className="card-soft mt-6 p-8 text-center">
          <Lightbulb className="mx-auto size-10 text-honey-dark" />
          <p className="mt-3 font-heading text-xl font-bold">Aucune idée pour l&apos;instant</p>
          <p className="mt-1 text-ink-soft">Une activité qui a plu à vos enfants ? Partagez-la avec vos photos.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {subs.map((s) => {
            const photos = parsePhotos(s.photos);
            return (
              <li key={s.id}>
                <Link href={`/espace-createur/idees/${s.id}`} className="card-soft card-hover flex items-center gap-4 p-3 sm:p-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photos.length > 0 ? <img src={`/api/createur/soumissions/${s.id}/photos/0`} alt="" className="size-full object-cover" loading="lazy" /> : <Lightbulb className="m-4 size-8 text-ink-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{s.title}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">Modifiée le {formatDate(s.updatedAt)}{s.product?.status === "PUBLISHED" ? ` · en vente : ${s.product.name}` : ""}</p>
                    <p className="mt-2"><SubmissionStatusBadge status={s.status} /></p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
