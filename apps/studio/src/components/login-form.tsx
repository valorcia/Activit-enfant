"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <label className="block text-sm font-medium">
        Mot de passe
        <input name="password" type="password" required minLength={8} autoComplete="current-password" autoFocus className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-slate-900 focus:outline-none" />
      </label>
      {state?.error && <p role="alert" className="text-sm font-medium text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{pending ? "Connexion…" : "Entrer"}</button>
    </form>
  );
}
