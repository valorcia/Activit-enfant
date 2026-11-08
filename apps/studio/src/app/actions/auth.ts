"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, expectedSessionToken, isValidPassword } from "@/lib/auth";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") || "/");
  if (!isValidPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit la force brute
    return { error: "Mot de passe incorrect." };
  }
  const token = await expectedSessionToken();
  if (!token) return { error: "La protection par mot de passe n'est pas configurée." };
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/connexion");
}
