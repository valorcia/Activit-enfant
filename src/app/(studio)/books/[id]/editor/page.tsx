import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildContextForBook } from "@/lib/layout/book";
import { PageLayoutSchema } from "@/lib/schemas/layout";
import { PageEditor } from "@/components/editor/page-editor";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const book = await prisma.book.findUnique({ where: { id }, include: { pages: { orderBy: { position: "asc" } } } });
  if (!book) notFound();
  const ctx = await buildContextForBook(id);
  return (
    <PageEditor
      bookId={id}
      bookTitle={book.title}
      theme={ctx.theme}
      initialPages={book.pages.map((p) => ({ id: p.id, templateKey: p.templateKey, locked: p.locked, activityId: p.activityId, layout: PageLayoutSchema.parse(p.layout) }))}
      initialIndex={Number(sp.page ?? 0) || 0}
    />
  );
}
