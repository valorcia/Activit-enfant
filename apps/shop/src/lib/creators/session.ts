import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Creator } from "@prisma/client";
import { env } from "@/lib/env";
import { creatorFromSession } from "./auth";
import { CONTRACT_VERSION } from "./contract";
import { CREATOR_SESSION_COOKIE, CREATOR_SESSION_DAYS } from "./tokens";

export async function setCreatorSessionCookie(token: string) {
  (await cookies()).set(CREATOR_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: CREATOR_SESSION_DAYS * 86400,
  });
}

export async function clearCreatorSessionCookie() {
  (await cookies()).delete(CREATOR_SESSION_COOKIE);
}

export async function getCurrentCreator(): Promise<Creator | null> {
  const token = (await cookies()).get(CREATOR_SESSION_COOKIE)?.value;
  return creatorFromSession(token);
}

/** Pages de l'espace créatrice : connexion requise. */
export async function requireCreator(): Promise<Creator> {
  const creator = await getCurrentCreator();
  if (!creator) redirect("/espace-createur/connexion");
  return creator;
}

/** Pages qui exigent le contrat en vigueur accepté (propositions, profil de paiement…). */
export async function requireCreatorWithContract(): Promise<Creator> {
  const creator = await requireCreator();
  if (creator.contractVersion !== CONTRACT_VERSION) redirect("/espace-createur/contrat");
  return creator;
}

/** Server actions : lève une erreur plutôt qu'une redirection. */
export async function assertCreator(opts: { contract?: boolean } = {}): Promise<Creator> {
  const creator = await getCurrentCreator();
  if (!creator) throw new Error("Session expirée : reconnectez-vous");
  if (opts.contract && creator.contractVersion !== CONTRACT_VERSION) throw new Error("Acceptez d'abord le contrat créatrice");
  return creator;
}
