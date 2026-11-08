"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, PlusCircle, Library, Palette, FileDown, Settings, ListChecks, Sparkles, ClipboardPaste, Store, Wand2, Clapperboard, Rocket } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/autopilot", label: "Pilote automatique", icon: Rocket },
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/books/new", label: "Nouveau kit", icon: PlusCircle },
  { href: "/brief", label: "Créer depuis un brief", icon: Wand2 },
  { href: "/books", label: "Livres et kits", icon: BookOpen },
  { href: "/shop", label: "Boutique", icon: Store },
  { href: "/activities/new", label: "Nouvelle activité", icon: Sparkles },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/templates", label: "Modèles graphiques", icon: Palette },
  { href: "/exports", label: "Exports", icon: FileDown },
  { href: "/videos", label: "Vidéos", icon: Clapperboard },
  { href: "/jobs", label: "Tâches", icon: ListChecks },
  { href: "/manual", label: "À coller", icon: ClipboardPaste },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function Sidebar({ mode = "api", pendingManual = 0, activeRuns = 0, studioName = "La Malle à Jeux · Studio" }: { mode?: "api" | "manual"; pendingManual?: number; activeRuns?: number; studioName?: string }) {
  const [brand, sub] = studioName.includes("·") ? studioName.split("·").map((x) => x.trim()) : [studioName, "Studio"];
  const pathname = usePathname();
  if (pathname.startsWith("/print") || pathname.includes("/editor")) return null;
  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-5 py-5 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black">{brand.charAt(0).toUpperCase()}</span>
          <div>
            <div className="font-black leading-tight">{brand}</div>
            <div className="text-[11px] text-slate-500 leading-tight">{sub || "Studio"}</div>
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
              {n.href === "/autopilot" && activeRuns > 0 && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{activeRuns}</span>}
            </Link>
          );
        })}
      </nav>
      <ModeToggle mode={mode} />
      <div className="flex items-center justify-between p-4 text-[11px] text-slate-400 border-t border-slate-100"><span>v0.1 · production éditoriale</span><form action={logoutAction}><button className="rounded px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Déconnexion</button></form></div>
    </aside>
  );
}
