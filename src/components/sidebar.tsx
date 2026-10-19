"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, PlusCircle, Library, Palette, FileDown, Settings, ListChecks, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/books/new", label: "Nouveau livre", icon: PlusCircle },
  { href: "/books", label: "Livres", icon: BookOpen },
  { href: "/activities/new", label: "Nouvelle activité", icon: Sparkles },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/templates", label: "Modèles graphiques", icon: Palette },
  { href: "/exports", label: "Exports", icon: FileDown },
  { href: "/jobs", label: "Tâches", icon: ListChecks },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar() {
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
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-[11px] text-slate-400 border-t border-slate-100">v0.1 · production éditoriale</div>
    </aside>
  );
}
