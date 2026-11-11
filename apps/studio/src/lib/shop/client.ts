/**
 * Client de l'API v1 de la boutique (apps/shop). Serveur uniquement : la clé
 * n'est jamais envoyée au navigateur.
 */
export interface ShopClientConfig { baseUrl: string; apiKey: string }

export class ShopApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  needsReview: boolean;
  publicUrl: string | null;
  editUrl: string;
  /** Univers du produit (boutique multi-univers) */
  site?: { slug: string; name: string; url?: string | null } | null;
  images: Array<{ id: string; url: string; role: string }>;
  files: Array<{ id: string; name: string; kind: string }>;
  [key: string]: unknown;
}

export interface ShopCategory { id: string; slug: string; name: string }

export interface ShopPeriodStats { orders: number; units: number; revenueCents: number; revenueNetCents: number; refundedCents: number }
export interface ShopProductStats { productId: string; currency: string; total: ShopPeriodStats; last30Days: ShopPeriodStats; lastOrderAt: string | null }

export class ShopClient {
  constructor(private cfg: ShopClientConfig) {
    if (!cfg.baseUrl || !cfg.apiKey) throw new ShopApiError("Boutique non configurée (URL ou clé API manquante)", 0);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; meta: Record<string, unknown> }> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.cfg.apiKey}`);
    headers.set("Accept", "application/json");
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/api/v1${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(120_000) });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { body = { error: text.slice(0, 300) }; }
    if (!res.ok) {
      const msg = typeof body.error === "string" ? body.error : `Erreur ${res.status}`;
      throw new ShopApiError(msg, res.status, body.details);
    }
    const { data, ...meta } = body;
    return { data: data as T, meta };
  }

  private json(path: string, method: string, payload: unknown) {
    return this.request<ShopProduct>(path, { method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
  }

  /** Univers de la boutique (multi-univers). 404 si la boutique ne les gère pas encore. */
  async sites(): Promise<unknown[]> {
    return (await this.request<unknown[]>("/sites")).data ?? [];
  }
  async categories(): Promise<ShopCategory[]> {
    return (await this.request<ShopCategory[]>("/categories")).data;
  }
  async collections(): Promise<ShopCategory[]> {
    return (await this.request<ShopCategory[]>("/collections")).data;
  }
  async getProduct(idOrSlug: string): Promise<ShopProduct | null> {
    try { return (await this.request<ShopProduct>(`/products/${encodeURIComponent(idOrSlug)}`)).data; }
    catch (e) { if (e instanceof ShopApiError && e.status === 404) return null; throw e; }
  }
  async findBySlug(slug: string): Promise<ShopProduct | null> {
    const r = await this.request<ShopProduct[]>(`/products?slug=${encodeURIComponent(slug)}&perPage=1`);
    return r.data[0] ?? null;
  }
  async listProducts(opts: { page?: number; perPage?: number; status?: string } = {}) {
    const q = new URLSearchParams({ page: String(opts.page ?? 1), perPage: String(opts.perPage ?? 100), status: opts.status ?? "all" });
    const r = await this.request<ShopProduct[]>(`/products?${q}`);
    return { items: r.data, total: Number(r.meta.total ?? r.data.length), page: Number(r.meta.page ?? 1), perPage: Number(r.meta.perPage ?? 100) };
  }
  /** Tous les produits, toutes pages, tous statuts. */
  async allProducts(): Promise<ShopProduct[]> {
    const out: ShopProduct[] = [];
    for (let page = 1; page < 50; page++) {
      const r = await this.listProducts({ page, perPage: 100 });
      out.push(...r.items);
      if (out.length >= r.total || r.items.length === 0) break;
    }
    return out;
  }
  async productStats(idOrSlug: string): Promise<ShopProductStats | null> {
    try { return (await this.request<ShopProductStats>(`/products/${encodeURIComponent(idOrSlug)}/stats`)).data; }
    catch (e) { if (e instanceof ShopApiError && e.status === 404) return null; throw e; }
  }
  /** Télécharge une image publique de la boutique (URL absolue ou relative au domaine). */
  async downloadImage(url: string): Promise<{ data: Buffer; mime: string } | null> {
    const abs = url.startsWith("http") ? url : `${this.cfg.baseUrl.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
    const res = await fetch(abs, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type")?.split(";")[0] ?? "image/png" };
  }
  async createProduct(payload: Record<string, unknown>) {
    return this.json("/products", "POST", payload);
  }
  async updateProduct(id: string, payload: Record<string, unknown>) {
    return this.json(`/products/${id}`, "PATCH", payload);
  }
  async uploadImage(id: string, file: { data: Buffer; mime: string; name: string }, opts: { role: string; alt?: string; replace?: boolean }) {
    const fd = new FormData();
    fd.set("file", new Blob([new Uint8Array(file.data)], { type: file.mime }), file.name);
    fd.set("role", opts.role);
    if (opts.alt) fd.set("alt", opts.alt);
    if (opts.replace) fd.set("replace", "1");
    return (await this.request<{ id: string; url: string; role: string }>(`/products/${id}/images`, { method: "POST", body: fd })).data;
  }
  async uploadFile(id: string, file: { data: Buffer; mime: string; name: string }, opts: { kind: string; description?: string; replace?: boolean }) {
    // Gros PDF (> 4 Mo, limite des requêtes Vercel) : dépôt direct dans le stockage privé par URL signée
    if (file.data.length > 4 * 1024 * 1024) {
      const presigned = await this.request<{ key: string; uploadUrl: string } | null>(`/products/${id}/files/presign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mime: file.mime }) }).then((r) => r.data).catch(() => null);
      if (presigned?.uploadUrl) {
        const put = await fetch(presigned.uploadUrl, { method: "PUT", body: new Uint8Array(file.data), headers: { "Content-Type": file.mime } });
        if (!put.ok) throw new Error(`Dépôt du PDF dans le stockage refusé (${put.status})`);
        return (await this.request<{ id: string; name: string; kind: string; sizeBytes: number }>(`/products/${id}/files/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: presigned.key, name: file.name, mime: file.mime, kind: opts.kind, description: opts.description, replace: Boolean(opts.replace) }) })).data;
      }
    }
    const fd = new FormData();
    fd.set("file", new Blob([new Uint8Array(file.data)], { type: file.mime }), file.name);
    fd.set("kind", opts.kind);
    fd.set("name", file.name);
    if (opts.description) fd.set("description", opts.description);
    if (opts.replace) fd.set("replace", "1");
    return (await this.request<{ id: string; name: string; kind: string; sizeBytes: number }>(`/products/${id}/files`, { method: "POST", body: fd })).data;
  }
  async publish(id: string, scheduledAt?: Date) {
    return this.json(`/products/${id}/publish`, "POST", scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {});
  }
}
