import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  className?: string;
  render: (row: T) => React.ReactNode;
}

/** Table responsive simple : en-têtes masqués sur mobile, libellés affichés en ligne. */
export function DataTable<T>({ columns, rows, rowKey, empty = "Aucun élément.", className }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: string; className?: string }) {
  if (rows.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center text-sm text-ink-soft">{empty}</p>;
  }
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-white", className)}>
      <table className="w-full text-sm">
        <thead className="hidden bg-[#F6F3EE] text-left text-xs font-bold uppercase tracking-wide text-ink-muted md:table-header-group">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3", c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="block p-3 md:table-row md:p-0 hover:bg-[#FBFAF7]">
              {columns.map((c) => (
                <td key={c.key} className={cn("block py-1 md:table-cell md:px-4 md:py-3 md:align-middle", c.className)}>
                  <span className="mr-2 inline-block text-[11px] font-bold uppercase text-ink-muted md:hidden">{c.header}</span>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPagination({ page, pages, buildHref }: { page: number; pages: number; buildHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <a href={buildHref(Math.max(1, page - 1))} aria-disabled={page <= 1} className={cn("rounded-full px-4 py-2 font-bold", page <= 1 ? "pointer-events-none opacity-40" : "bg-white hover:bg-ink/5 border border-line")}>← Précédent</a>
      <span className="text-ink-muted">Page {page} / {pages}</span>
      <a href={buildHref(Math.min(pages, page + 1))} aria-disabled={page >= pages} className={cn("rounded-full px-4 py-2 font-bold", page >= pages ? "pointer-events-none opacity-40" : "bg-white hover:bg-ink/5 border border-line")}>Suivant →</a>
    </nav>
  );
}
