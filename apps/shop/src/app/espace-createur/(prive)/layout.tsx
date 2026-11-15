import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireCreator } from "@/lib/creators/session";
import { CONTRACT_VERSION } from "@/lib/creators/contract";
import { getSetting } from "@/lib/settings";
import { logoutCreatorAction } from "@/app/actions/creator";
import { CreatorNav } from "@/components/creator/creator-nav";

export const metadata: Metadata = { title: { default: "Espace créatrice", template: "%s · Espace créatrice" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const [creator, brand] = await Promise.all([requireCreator(), getSetting("brand")]);
  const needsContract = creator.contractVersion !== CONTRACT_VERSION;
  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/espace-createur" className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-coral font-heading font-bold text-white">{brand.name.charAt(0)}</span>
            <span className="min-w-0 font-heading font-bold leading-tight"><span className="block truncate">{brand.name}</span><span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Espace créatrice</span></span>
          </Link>
          <span className="ml-auto hidden truncate text-sm font-semibold text-ink-soft sm:block">{creator.publicName ?? creator.name}</span>
          <form action={logoutCreatorAction} className="lg:hidden"><button aria-label="Me déconnecter" className="rounded-full p-2 text-ink-muted hover:bg-ink/5"><LogOut className="size-5" /></button></form>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[220px_1fr] lg:py-10">
        <aside className="hidden lg:block"><div className="sticky top-24"><CreatorNav needsContract={needsContract} /></div></aside>
        <main id="contenu" className="min-w-0">{children}</main>
      </div>
      <div className="lg:hidden"><CreatorNav needsContract={needsContract} /></div>
    </div>
  );
}
