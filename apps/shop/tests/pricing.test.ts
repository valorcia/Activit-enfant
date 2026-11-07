import { describe, expect, it } from "vitest";
import { applyCoupon, computeTotals, effectivePrice, includedTax, isSaleActive, type PricedLine } from "@/lib/pricing";

const now = new Date("2026-06-15T12:00:00Z");

describe("effectivePrice", () => {
  it("retourne le prix normal sans promotion", () => {
    expect(effectivePrice({ priceCents: 990 }, now)).toEqual({ priceCents: 990, compareAtCents: null, isOnSale: false, discountPercent: null });
  });
  it("applique la promotion active avec prix barré et pourcentage", () => {
    const p = effectivePrice({ priceCents: 1000, salePriceCents: 750, saleStartsAt: "2026-06-01", saleEndsAt: "2026-06-30" }, now);
    expect(p).toEqual({ priceCents: 750, compareAtCents: 1000, isOnSale: true, discountPercent: 25 });
  });
  it("ignore une promotion hors période", () => {
    expect(isSaleActive({ priceCents: 1000, salePriceCents: 750, saleStartsAt: "2026-07-01" }, now)).toBe(false);
    expect(isSaleActive({ priceCents: 1000, salePriceCents: 750, saleEndsAt: "2026-06-01" }, now)).toBe(false);
  });
  it("ignore un prix promo supérieur ou égal au prix normal", () => {
    expect(isSaleActive({ priceCents: 1000, salePriceCents: 1000 }, now)).toBe(false);
  });
});

describe("applyCoupon", () => {
  const base = { code: "TEST", isActive: true };
  it("calcule une remise en pourcentage et la plafonne au sous-total", () => {
    expect(applyCoupon({ ...base, type: "PERCENT", percentOff: 20 }, 1000, now)).toEqual({ ok: true, discountCents: 200 });
    expect(applyCoupon({ ...base, type: "FIXED", amountOffCents: 5000 }, 1000, now)).toEqual({ ok: true, discountCents: 1000 });
  });
  it("refuse un code inactif, expiré, épuisé ou sous le minimum", () => {
    expect(applyCoupon({ ...base, type: "PERCENT", percentOff: 10, isActive: false }, 1000, now).ok).toBe(false);
    expect(applyCoupon({ ...base, type: "PERCENT", percentOff: 10, endsAt: "2026-01-01" }, 1000, now).ok).toBe(false);
    expect(applyCoupon({ ...base, type: "PERCENT", percentOff: 10, startsAt: "2027-01-01" }, 1000, now).ok).toBe(false);
    expect(applyCoupon({ ...base, type: "PERCENT", percentOff: 10, maxUses: 5, usedCount: 5 }, 1000, now).ok).toBe(false);
    expect(applyCoupon({ ...base, type: "PERCENT", percentOff: 10, minSubtotalCents: 2000 }, 1000, now).ok).toBe(false);
    expect(applyCoupon(null, 1000, now).ok).toBe(false);
  });
});

describe("computeTotals / TVA incluse", () => {
  const lines: PricedLine[] = [
    { kind: "product", id: "a", name: "A", quantity: 1, unitPriceCents: 1200, compareAtCents: null, totalCents: 1200, taxRateBp: 2000 },
    { kind: "product", id: "b", name: "B", quantity: 2, unitPriceCents: 400, compareAtCents: null, totalCents: 800, taxRateBp: 550 },
  ];
  it("extrait la TVA incluse d'un prix TTC", () => {
    expect(includedTax(1200, 2000)).toBe(200);
    expect(includedTax(1000, 0)).toBe(0);
  });
  it("somme les lignes, applique la remise et répartit la TVA", () => {
    const t = computeTotals(lines, 200);
    expect(t.subtotalCents).toBe(2000);
    expect(t.discountCents).toBe(200);
    expect(t.totalCents).toBe(1800);
    // A : 1200 − 120 de remise = 1080 → TVA 20 % incluse = 180 ; B : 800 − 80 = 720 → TVA 5,5 % ≈ 38
    expect(t.taxCents).toBe(180 + 38);
  });
  it("plafonne la remise au sous-total", () => {
    expect(computeTotals(lines, 99999).totalCents).toBe(0);
  });
});
