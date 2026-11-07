import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { LoginForm } from "@/components/admin/login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const user = await getAdminUser();
  if (user) redirect("/admin");
  const { callbackUrl } = await searchParams;
  const brand = await getSetting("brand");
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-coral text-2xl font-heading font-bold text-white shadow-soft rotate-[-6deg]">{brand.name.charAt(0)}</span>
          <h1 className="mt-4 font-heading text-2xl font-bold">{brand.name}</h1>
          <p className="text-sm text-ink-soft">Espace d&apos;administration</p>
        </div>
        <div className="card-soft p-6">
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </div>
  );
}
