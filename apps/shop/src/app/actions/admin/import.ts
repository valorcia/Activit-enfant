"use server";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { importProducts, parseProductsCsv, type ParsedCsvRow } from "@/lib/import/csv";
import { handleActionError, succeed, fail, type ActionResult } from "@/lib/admin/action-result";

export interface CsvPreview { columns: string[]; total: number; valid: number; invalid: number; sample: Array<{ line: number; name: string; price: string; status: string; errors: string[] }>; text: string; fileName: string }

export async function previewCsvAction(formData: FormData): Promise<ActionResult<CsvPreview>> {
  try {
    await assertPermission("products:import");
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Fichier CSV manquant");
    if (file.size > 10 * 1024 * 1024) return fail("Fichier trop volumineux (10 Mo max)");
    const text = await file.text();
    const { rows, columns } = parseProductsCsv(text);
    if (rows.length === 0) return fail("Aucune ligne trouvée dans le fichier");
    if (!columns.includes("name") || !columns.includes("price")) return fail("Colonnes obligatoires manquantes : name, price (téléchargez le modèle CSV)");
    return succeed({
      columns, total: rows.length, valid: rows.filter((r) => !r.errors.length).length, invalid: rows.filter((r) => r.errors.length).length,
      sample: rows.slice(0, 10).map((r) => ({ line: r.line, name: r.raw.name ?? "", price: r.raw.price ?? "", status: r.raw.status ?? "DRAFT", errors: r.errors })),
      text, fileName: file.name,
    });
  } catch (e) { return handleActionError(e); }
}

export async function runImportAction(text: string, fileName: string): Promise<ActionResult<{ created: number; updated: number; failed: number; errors: Array<{ line: number; name?: string; error: string }> }>> {
  try {
    const user = await assertPermission("products:import");
    const { rows } = parseProductsCsv(text);
    const valid: ParsedCsvRow[] = rows;
    const result = await importProducts(valid, { userId: user.id, actor: user.email, source: "csv" }, { source: "CSV", fileName });
    await audit({ userId: user.id, action: "import.csv", entity: "import", entityId: result.jobId, data: { created: result.created, updated: result.updated, failed: result.failed } });
    revalidatePath("/admin/import");
    revalidatePath("/admin/produits");
    return succeed({ created: result.created, updated: result.updated, failed: result.failed, errors: result.errors });
  } catch (e) { return handleActionError(e); }
}
