"use server";
import { redirect } from "next/navigation";
import { clearCustomerSession, customerFromProof, setCustomerSession, type RememberInput } from "@/lib/customers/session";


/**
 * Mémorise le client sur cet appareil après une preuve d'accès : session Stripe d'une commande
 * payée récemment, jeton signé de la page de commande, ou lien d'accès « mes achats » valide.
 */
export async function rememberCustomerAction(input: RememberInput): Promise<{ ok: boolean }> {
  try {
    const customerId = await customerFromProof(input);
    if (!customerId) return { ok: false };
    await setCustomerSession(customerId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function logoutCustomerAction() {
  await clearCustomerSession();
  redirect("/mon-compte");
}
