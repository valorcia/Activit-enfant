import { PageHeader } from "@/components/page-header";
import { NewActivityForm } from "@/components/new-activity-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const books = await prisma.book.findMany({ where: { status: { notIn: ["ARCHIVED"] } }, select: { id: true, title: true, ageRange: true }, orderBy: { updatedAt: "desc" } });
  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Nouvelle activité" description="Décrivez le concept ; la fiche complète sera rédigée par l'IA, puis illustrée." />
      <NewActivityForm books={books} defaultBookId={sp.book} />
    </div>
  );
}
