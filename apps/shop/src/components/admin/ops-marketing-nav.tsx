"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/marketing", label: "Rentabilité" },
  { href: "/admin/marketing/campagnes", label: "Campagnes" },
  { href: "/admin/marketing/autopilote", label: "Autopilote" },
  { href: "/admin/marketing/posts", label: "Posts & publicités" },
  { href: "/admin/marketing/etsy", label: "Etsy" },
  { href: "/admin/marketing/connecteurs", label: "Connecteurs" },
];

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Marketing social" className="mb-6 flex flex-wrap gap-1 rounded-full bg-ink/5 p-1 w-fit">
      {TABS.map((t) => {
        const active = t.href === "/admin/marketing" ? pathname === t.href : pathname.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={cn("rounded-full px-4 py-1.5 text-sm font-bold font-heading transition-colors", active ? "bg-white shadow-sm text-ink" : "text-ink-soft hover:text-ink")}>{t.label}</Link>;
      })}
    </nav>
  );
}
