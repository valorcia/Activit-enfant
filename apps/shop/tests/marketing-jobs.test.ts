import { describe, expect, it } from "vitest";
import { canReceiveMarketing, isAbandoned } from "@/lib/marketing/jobs";

const d = (s: string) => new Date(s);

describe("canReceiveMarketing", () => {
  it("refuse un désinscrit quel que soit l'historique", () => {
    expect(canReceiveMarketing([{ purpose: "promotions", granted: true, createdAt: d("2026-01-02") }], "UNSUBSCRIBED")).toBe(false);
  });
  it("suit le dernier consentement enregistré", () => {
    expect(canReceiveMarketing([{ purpose: "newsletter", granted: true, createdAt: d("2026-01-01") }, { purpose: "promotions", granted: false, createdAt: d("2026-02-01") }], "CONFIRMED")).toBe(false);
    expect(canReceiveMarketing([{ purpose: "promotions", granted: false, createdAt: d("2026-01-01") }, { purpose: "promotions", granted: true, createdAt: d("2026-02-01") }], null)).toBe(true);
  });
  it("sans consentement explicite, seul un abonné confirmé peut être relancé", () => {
    expect(canReceiveMarketing([], "CONFIRMED")).toBe(true);
    expect(canReceiveMarketing([], "PENDING")).toBe(false);
    expect(canReceiveMarketing([], null)).toBe(false);
  });
});

describe("isAbandoned", () => {
  const now = d("2026-06-01T12:00:00Z");
  it("détecte une commande en attente plus ancienne que le délai, avec email, non relancée", () => {
    expect(isAbandoned({ status: "PENDING", email: "a@b.c", createdAt: d("2026-06-01T09:00:00Z"), abandonedEmailSentAt: null }, 120, now)).toBe(true);
    expect(isAbandoned({ status: "PENDING", email: "a@b.c", createdAt: d("2026-06-01T11:30:00Z"), abandonedEmailSentAt: null }, 120, now)).toBe(false);
    expect(isAbandoned({ status: "PAID", email: "a@b.c", createdAt: d("2026-06-01T09:00:00Z"), abandonedEmailSentAt: null }, 120, now)).toBe(false);
    expect(isAbandoned({ status: "PENDING", email: "", createdAt: d("2026-06-01T09:00:00Z"), abandonedEmailSentAt: null }, 120, now)).toBe(false);
    expect(isAbandoned({ status: "PENDING", email: "a@b.c", createdAt: d("2026-06-01T09:00:00Z"), abandonedEmailSentAt: d("2026-06-01T11:00:00Z") }, 120, now)).toBe(false);
  });
});
