import { Markdown } from "@/components/markdown";
import { Breadcrumbs } from "./breadcrumbs";

export function StaticPageView({ page }: { page: { title: string; content: string; updatedAt: Date } }) {
  return (
    <div className="container-shell max-w-3xl py-10 sm:py-14">
      <Breadcrumbs items={[{ label: page.title }]} className="mb-6" />
      <article className="card-soft p-6 sm:p-10">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">{page.title}</h1>
        <p className="mt-1 text-xs text-ink-muted">Dernière mise à jour : {page.updatedAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}</p>
        <Markdown content={page.content.replace(/^#\s+.+\n/, "")} className="mt-6" />
      </article>
    </div>
  );
}
