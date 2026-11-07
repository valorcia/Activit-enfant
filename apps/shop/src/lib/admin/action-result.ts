import { z } from "zod";

export type FieldErrors = Record<string, string[]>;
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
export function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Transforme une erreur Zod en erreurs par champ (clé = chemin point-séparé). */
export function zodFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.map(String).join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function handleActionError(e: unknown): ActionResult<never> {
  if (e instanceof z.ZodError) return fail("Certains champs sont invalides.", zodFieldErrors(e));
  if (e instanceof Error) return fail(e.message);
  return fail("Erreur inattendue");
}
