import { describe, expect, it } from "vitest";
import { PERMISSIONS, roleCan, type Permission } from "@/lib/auth/permissions";

describe("roleCan", () => {
  it("ADMIN possède toutes les permissions", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(roleCan("ADMIN", p)).toBe(true);
  });
  it("EDITOR gère le catalogue mais ni les remboursements ni les paramètres", () => {
    expect(roleCan("EDITOR", "products:write")).toBe(true);
    expect(roleCan("EDITOR", "products:publish")).toBe(true);
    expect(roleCan("EDITOR", "orders:refund")).toBe(false);
    expect(roleCan("EDITOR", "settings:write")).toBe(false);
    expect(roleCan("EDITOR", "users:write")).toBe(false);
  });
  it("MARKETING gère promos, avis, newsletter, apparence, pas les produits ni les remboursements", () => {
    expect(roleCan("MARKETING", "coupons:write")).toBe(true);
    expect(roleCan("MARKETING", "appearance:write")).toBe(true);
    expect(roleCan("MARKETING", "reviews:moderate")).toBe(true);
    expect(roleCan("MARKETING", "products:write")).toBe(false);
    expect(roleCan("MARKETING", "orders:refund")).toBe(false);
  });
  it("SUPPORT gère commandes, clients, remboursements et avis, pas le catalogue", () => {
    expect(roleCan("SUPPORT", "orders:read")).toBe(true);
    expect(roleCan("SUPPORT", "orders:refund")).toBe(true);
    expect(roleCan("SUPPORT", "customers:read")).toBe(true);
    expect(roleCan("SUPPORT", "products:write")).toBe(false);
    expect(roleCan("SUPPORT", "appearance:write")).toBe(false);
  });
  it("refuse sans rôle", () => {
    expect(roleCan(null, "dashboard:view")).toBe(false);
    expect(roleCan(undefined, "products:read")).toBe(false);
  });
});
