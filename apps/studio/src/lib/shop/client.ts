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
  images: Array<{ id: string; url: string; role: string }>;
  files: Array<{ id: string; name: string; kind: string }>;
  [key: string]: unknown;
}

export interface ShopCategory { id: string; slug: string; name: string }

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
