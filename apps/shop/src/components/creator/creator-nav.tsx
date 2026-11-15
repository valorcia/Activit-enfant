"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSignature, LayoutDashboard, Lightbulb, LogOut, PlusCircle, UserRound } from "lucide-react";
import { logoutCreatorAction } from "@/app/actions/creator";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/espace-createur", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard },
  { href: "/espace-createur/idees", label: "Mes idées", short: "Idées", icon: Lightbulb },
  { href: "/espace-createur/idees/nouvelle", label: "Proposer une idée", short: "Proposer", icon: PlusCircle },
  { href: "/espace-createur/profil", label: "Mon profil", short: "Profil", icon: UserRound },
  { href: "/espace-createur/contrat", label: "Contrat", short: "Contrat", icon: FileSignature },
];

/** Navigation de l'espace créatrice : barre latérale (ordinateur) et barre du bas (téléphone). */
export function CreatorNav({ needsContract }: { needsContract: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/espace-createur" ? pathname === href : href === "/espace-createur/idees" ? pathname.startsWith(href) && !pathname.startsWith("/espace-createur/idees/nouvelle") : pathname.startsWith(href));
  const items = needsContract ? NAV.filter((n) => n.href === "/espace-createur/contrat") : NAV;
  return (
    <>
      <nav aria-label="Espace créatrice" className="hidden lg:block">
        <ul className="space-y-1">
          {items.map((n) => (
            <li key={n.href}><Link href={n.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold", active(n.href) ? "bg-ink text-white" : "text-ink/80 hover:bg-ink/5")}><n.icon className="size-4" /> {n.label}</Link></li>
          ))}
        </ul>
        <form action={logoutCreatorAction} className="mt-6"><button className="flex items-center gap-2 px-3 text-sm font-semibold text-ink-muted hover:text-ink"><LogOut className="size-4" /> Me déconnecter</button></form>
      </nav>
      <nav aria-label="Espace créatrice" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((n) => (
            <li key={n.href}><Link href={n.href} className={cn("flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-bold", active(n.href) ? "text-coral-dark" : "text-ink-muted")}><n.icon className="size-5" /> {n.short}</Link></li>
          ))}
        </ul>
      </nav>
    </>
  );
}
