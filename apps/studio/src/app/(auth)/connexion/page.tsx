import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthEnabled, isValidSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!isAuthEnabled()) redirect("/");
  if (await isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Inventor Studio</h1>
        <p className="mt-1 text-sm text-slate-500">Espace de création protégé. Saisissez le mot de passe du studio.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
