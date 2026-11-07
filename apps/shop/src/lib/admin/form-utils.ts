/** Convertit un montant en euros saisi (« 9,90 ») en centimes. */
export function eurosToCents(v: string | number | null | undefined): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}
export function centsToEuros(c: number | null | undefined): string {
  if (c == null) return "";
  return (c / 100).toFixed(2);
}

/** Date → valeur pour <input type="datetime-local"> (heure locale). */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
