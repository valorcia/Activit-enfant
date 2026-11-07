"use server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function signInAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  try {
    const callbackUrl = String(formData.get("callbackUrl") || "/admin");
    await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: callbackUrl.startsWith("/admin") ? callbackUrl : "/admin" });
    return {};
  } catch (e) {
    if (e instanceof AuthError) return { error: "Email ou mot de passe incorrect." };
    throw e; // redirection Next.js
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/admin/connexion" });
}
