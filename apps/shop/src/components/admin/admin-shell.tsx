"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, BookOpen, Boxes, FileText, Gift, Home, Import, KeyRound, LayoutGrid, LogOut, Mail, Menu, MessageSquareQuote, Package, Palette, Settings, ShoppingCart, Tags, TicketPercent, Users, X, ExternalLink } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { roleCan, type Permission, ROLE_LABELS } from "@/lib/auth/permissions";
import type { AdminUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }>; permission: Permission }

const NAV: Array<{ title: string; items: NavItem[] }> = [
  { title: "Pilotage", items: [
    { href: "/admin", label: "Tableau de bord", icon: BarChart3, permission: "dashboard:view" },
    { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart, permission: "orders:read" },
    { href: "/admin/clients", label: "Clients", icon: Users, permission: "customers:read" },
  ] },
  { title: "Catalogue", items: [
    { href: "/admin/produits", label: "Produits", icon: Package, permission: "products:read" },
    { href: "/admin/categories", label: "Catégories", icon: LayoutGrid, permission: "products:read" },
    { href: "/admin/collections", label: "Collections", icon: Tags, permission: "products:read" },
    { href: "/admin/packs", label: "Packs", icon: Boxes, permission: "products:read" },
    { href: "/admin/import", label: "Importation", icon: Import, permission: "products:import" },
  ] },
  { title: "Marketing", items: [
    { href: "/admin/codes-promo", label: "Codes promo", icon: TicketPercent, permission: "coupons:write" },
    { href: "/admin/avis", label: "Avis clients", icon: MessageSquareQuote, permission: "reviews:moderate" },
    { href: "/admin/newsletter", label: "Newsletter", icon: Mail, permission: "newsletter:read" },
    { href: "/admin/blog", label: "Blog", icon: BookOpen, permission: "blog:write" },
  ] },
  { title: "Site", items: [
    { href: "/admin/apparence", label: "Apparence", icon: Palette, permission: "appearance:write" },
    { href: "/admin/pages", label: "Pages", icon: FileText, permission: "pages:write" },
    { href: "/admin/parametres", label: "Paramètres", icon: Settings, permission: "settings:write" },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, permission: "users:write" },
    { href: "/admin/api", label: "API & automatisation", icon: KeyRound, permission: "apikeys:write" },
  ] },
];

export function AdminShell({ user, brandName, children }: { user: AdminUser; brandName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-coral text-white font-heading font-bold">{brandName.charAt(0)}</span>
          <span className="font-heading text-lg font-bold leading-tight">{brandName}<span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Administration</span></span>
        </Link>
        <button className="lg:hidden rounded-full p-1.5 hover:bg-ink/5" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X className="size-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Administration">
        {NAV.map((group) => {
          const items = group.items.filter((i) => roleCan(user.role, i.permission));
          if (!items.length) return null;
          return (
            <div key={group.title} className="mb-4">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{group.title}</p>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors", isActive(i.href) ? "bg-ink text-white" : "text-ink/80 hover:bg-ink/5")}>
                      <i.icon className="size-4" /> {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-line p-4">
        <p className="truncate text-sm font-bold">{user.name ?? user.email}</p>
        <p className="text-xs text-ink-muted">{ROLE_LABELS[user.role]}</p>
        <div className="mt-3 flex gap-2">
          <Link href="/" target="_blank" className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold hover:bg-ink/10"><ExternalLink className="size-3.5" /> Voir le site</Link>
          <form action={signOutAction}><button className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold hover:bg-red-50 hover:text-red-700"><LogOut className="size-3.5" /> Déconnexion</button></form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#F6F3EE] text-ink lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block border-r border-line bg-white sticky top-0 h-dvh">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-white shadow-lift">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <button className="rounded-full p-2 hover:bg-ink/5" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu className="size-5" /></button>
          <span className="font-heading font-bold">Administration</span>
          <Link href="/" className="ml-auto text-ink-muted" aria-label="Accueil du site"><Home className="size-5" /></Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export { Gift };
