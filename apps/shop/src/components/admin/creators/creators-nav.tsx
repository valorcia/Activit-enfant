import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/createurs", label: "Créatrices" },
  { href: "/admin/createurs/moderation", label: "Modération" },
  { href: "/admin/createurs/commissions", label: "Commissions" },
  { href: "/admin/createurs/paiements", label: "Paiements" },
  { href: "/admin/createurs/reglages", label: "Réglages" },
];

export function CreatorsNav({ current, badges = {} }: { current: string; badges?: Record<string, number> }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Espace créatrices">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-bold", current === t.href ? "bg-ink text-white" : "border border-line bg-white hover:bg-ink/5")}>
          {t.label}{badges[t.href] ? <span className="ml-1.5 rounded-full bg-coral px-1.5 py-0.5 text-[10px] text-white">{badges[t.href]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export const SUBMISSION_PILL: Record<string, string> = {
  DRAFT: "bg-ink/10 text-ink", SUBMITTED: "bg-honey-light text-honey-dark", CHANGES_REQUESTED: "bg-lavender-light text-lavender-dark", ACCEPTED: "bg-sky-light text-sky-dark",
  REJECTED: "bg-red-100 text-red-800", IN_PRODUCTION: "bg-sky-light text-sky-dark", PREVIEW_READY: "bg-honey-light text-honey-dark", APPROVED: "bg-sage-light text-sage-dark", PUBLISHED: "bg-sage-light text-sage-dark",
  INVITED: "bg-honey-light text-honey-dark", ACTIVE: "bg-sage-light text-sage-dark", SUSPENDED: "bg-red-100 text-red-800",
  PENDING: "bg-honey-light text-honey-dark", CONFIRMED: "bg-sky-light text-sky-dark", CANCELLED: "bg-ink/5 text-ink-muted", PAID: "bg-sage-light text-sage-dark",
};

export function Pill({ status, label }: { status: string; label: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", SUBMISSION_PILL[status] ?? "bg-ink/10")}>{label}</span>;
}

export const CREATOR_STATUS_LABELS: Record<string, string> = { INVITED: "Invitée", ACTIVE: "Active", SUSPENDED: "Suspendue" };
