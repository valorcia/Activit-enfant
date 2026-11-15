import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * IBAN des créatrices : validé (clé ISO 13616, modulo 97), chiffré AES-256-GCM avec la
 * même fonction que les clés d'intégration, jamais stocké ni journalisé en clair.
 * Seuls les 4 derniers caractères sont conservés en clair pour l'affichage masqué.
 */

export function normalizeIban(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase();
}

const LENGTHS: Record<string, number> = { FR: 27, BE: 16, LU: 20, CH: 21, MC: 27, DE: 22, ES: 24, IT: 27, PT: 25, NL: 18, GB: 22, IE: 22, AT: 20 };

export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const expected = LENGTHS[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/** « •••• •••• •••• 1234 » à partir des 4 derniers caractères (seuls conservés en clair). */
export function maskIban(last4: string | null | undefined): string {
  if (!last4) return "";
  return `•••• •••• •••• ${last4}`;
}

export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

export function encryptIban(raw: string): { ibanEnc: string; ibanLast4: string } {
  const iban = normalizeIban(raw);
  if (!isValidIban(iban)) throw new Error("IBAN invalide : vérifiez sa saisie");
  return { ibanEnc: encryptSecret(iban), ibanLast4: iban.slice(-4) };
}

export function decryptIban(ibanEnc: string): string {
  return decryptSecret(ibanEnc);
}
