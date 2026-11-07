import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getToken = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: (...args: unknown[]) => getToken(...args) }));

const { proxy } = await import("@/proxy");

describe("protection des routes d'administration", () => {
  it("redirige vers la connexion sans session", async () => {
    getToken.mockResolvedValueOnce(null);
    const res = await proxy(new NextRequest("http://localhost:3000/admin/produits"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/admin/connexion");
    expect(location.searchParams.get("callbackUrl")).toBe("/admin/produits");
  });

  it("renvoie 401 pour les routes API admin sans session", async () => {
    getToken.mockResolvedValueOnce(null);
    const res = await proxy(new NextRequest("http://localhost:3000/api/admin/upload", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("laisse passer la page de connexion sans session", async () => {
    const res = await proxy(new NextRequest("http://localhost:3000/admin/connexion"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("laisse passer un utilisateur authentifié", async () => {
    getToken.mockResolvedValueOnce({ id: "u1", role: "ADMIN" });
    const res = await proxy(new NextRequest("http://localhost:3000/admin"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
