"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, PlusCircle, Library, Palette, FileDown, Settings, ListChecks, Sparkles, ClipboardPaste } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/books/new", label: "Nouveau livre", icon: PlusCircle },
  { href: "/books", label: "Livres", icon: BookOpen },
  { href: "/activities/new", label: "Nouvelle activité", icon: Sparkles },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/templates", label: "Modèles graphiques", icon: Palette },
  { href: "/exports", label: "Exports", icon: FileDown },
  { href: "/jobs", label: "Tâches", icon: ListChecks },
  { href: "/manual", label: "À coller", icon: ClipboardPaste },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar({ mode = "api", pendingManual = 0 }: { mode?: "api" | "manual"; pendingManual?: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/print") || pathname.includes("/editor")) return null;
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-5 py-5 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black">I</span>
          <div>
            <div className="font-black leading-tight">Inventor Studio</div>
            <div className="text-[11px] text-slate-500 leading-tight">Livres d'activités</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900", active && "bg-blue-50 text-blue-700 hover:bg-blue-50")}>
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.href === "/manual" && pendingManual > 0 && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{pendingManual}</span>}
            </Link>
          );
        })}
      </nav>
      <ModeToggle mode={mode} />
      <div className="flex items-center justify-between p-4 text-[11px] text-slate-400 border-t border-slate-100"><span>v0.1 · production éditoriale</span><form action={logoutAction}><button className="rounded px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Déconnexion</button></form></div>
    </aside>
  );
}
