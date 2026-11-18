"use client";
import { useState } from "react";
import type { BookPlan } from "@/lib/unwritten/book-plan";
import type { Dictionary } from "@/lib/unwritten/i18n/en";
import { BookPlanView } from "./book-plan";

/** Plan du livre sur la fiche produit, avec un sélecteur d'édition quand le plan en dépend. */
export function PlanByEdition({ plans, dict }: { plans: Array<{ key: string; label: string; plan: BookPlan }>; dict: Dictionary["plan"] }) {
  const [active, setActive] = useState(plans[0]?.key);
  const current = plans.find((p) => p.key === active) ?? plans[0];
  if (!current) return null;
  return (
    <div>
      {plans.length > 1 && (
        <div role="tablist" className="mb-6 flex flex-wrap gap-2">
          {plans.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={p.key === current.key}
              onClick={() => setActive(p.key)}
              className={`border px-3.5 py-1.5 text-[0.8rem] transition-colors ${p.key === current.key ? "border-[var(--uw-ink)] bg-[var(--uw-ink)] text-[var(--uw-white)]" : "border-[var(--uw-line-strong)] text-[var(--uw-soft)] hover:border-[var(--uw-ink)]"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <BookPlanView plan={current.plan} dict={dict} variant="product" />
    </div>
  );
}
