"use server";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { canEncryptSecrets, deleteSecret, getSecretStatus, isSecretKey, setSecret, type SecretStatus } from "@/lib/integrations/secrets";
import { serviceById } from "@/lib/integrations/services";
import { testServiceConnection, type ConnectionTestResult } from "@/lib/integrations/test-connection";

export type IntegrationResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/admin/parametres");
  revalidatePath("/admin/marketing/connecteurs");
  revalidatePath("/admin/marketing/posts");
}

/** Enregistre les clés d'un service. Un champ vide laisse la valeur actuelle inchangée. */
export async function saveIntegrationSecretsAction(serviceId: string, values: Record<string, string>): Promise<IntegrationResult<SecretStatus[]>> {
  try {
    const user = await assertPermission("settings:write");
    const service = serviceById(serviceId);
    if (!service) return { ok: false, error: "Service inconnu" };
    if (!canEncryptSecrets()) return { ok: false, error: "Chiffrement impossible : définissez AUTH_SECRET (ou MARKETING_ENCRYPTION_KEY) dans l'hébergement." };
    const allowed = new Set(service.fields.map((f) => f.key));
    let saved = 0;
    for (const [key, raw] of Object.entries(values)) {
      if (!isSecretKey(key) || !allowed.has(key)) return { ok: false, error: `Champ inconnu pour ce service : ${key}` };
      const value = (raw ?? "").trim();
      if (!value) continue;
      await setSecret(key, value, { userId: user.id, actor: user.email });
      saved++;
    }
    revalidate();
    if (saved === 0) return { ok: false, error: "Aucune valeur saisie : rien n'a été modifié." };
    return { ok: true, data: await getSecretStatus() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

/** Supprime une clé enregistrée dans la plateforme (la variable d'environnement reprend le relais si elle existe). */
export async function deleteIntegrationSecretAction(key: string): Promise<IntegrationResult<SecretStatus[]>> {
  try {
    const user = await assertPermission("settings:write");
    if (!isSecretKey(key)) return { ok: false, error: "Clé inconnue" };
    await deleteSecret(key, { userId: user.id, actor: user.email });
    revalidate();
    return { ok: true, data: await getSecretStatus() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function testIntegrationAction(serviceId: string): Promise<IntegrationResult<ConnectionTestResult>> {
  try {
    await assertPermission("settings:write");
    const service = serviceById(serviceId);
    if (!service) return { ok: false, error: "Service inconnu" };
    return { ok: true, data: await testServiceConnection(service.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}
