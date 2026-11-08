import fs from "node:fs";
import path from "node:path";
import type { ShopProduct } from "./product";

/** Lit une fiche produit via l'API boutique v1 (clé `SHOP_API_KEY`). */
export async function fetchShopProduct(shopUrl: string, idOrSlug: string, apiKey = process.env.SHOP_API_KEY ?? ""): Promise<ShopProduct> {
  if (!apiKey) throw new Error("SHOP_API_KEY manquante : créez une clé dans l'admin boutique (API & automatisation)");
  const res = await fetch(`${shopUrl.replace(/\/$/, "")}/api/v1/products/${encodeURIComponent(idOrSlug)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const body = (await res.json().catch(() => ({}))) as { data?: ShopProduct; error?: string };
  if (!res.ok || !body.data) throw new Error(`Produit introuvable (${res.status}) : ${body.error ?? "réponse inattendue"}`);
  return body.data;
}

/**
 * Envoie une vidéo à la boutique : elle devient un média VIDEO du produit, utilisable dans les posts.
 * Stockage S3 (cas Vercel) : téléversement direct via URL signée (pas de limite de 4,5 Mo).
 * Stockage local : envoi multipart classique.
 */
export async function publishVideoToShop(shopUrl: string, productId: string, filePath: string, opts: { format?: string; title?: string; apiKey?: string } = {}) {
  const apiKey = opts.apiKey ?? process.env.SHOP_API_KEY ?? "";
  if (!apiKey) throw new Error("SHOP_API_KEY manquante");
  const base = `${shopUrl.replace(/\/$/, "")}/api/v1/products/${encodeURIComponent(productId)}/videos`;
  const auth = { Authorization: `Bearer ${apiKey}` };
  const data = fs.readFileSync(filePath);
  const mime = filePath.endsWith(".webm") ? "video/webm" : filePath.endsWith(".mov") ? "video/quicktime" : "video/mp4";

  const presign = await fetch(base, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ action: "presign", contentType: mime }) });
  if (presign.ok) {
    const { data: p } = (await presign.json()) as { data: { key: string; uploadUrl: string } };
    const put = await fetch(p.uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: new Uint8Array(data) });
    if (!put.ok) throw new Error(`Téléversement vers le stockage refusé (${put.status})`);
    const reg = await fetch(base, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", key: p.key, format: opts.format ?? "story", title: opts.title }) });
    const body = (await reg.json().catch(() => ({}))) as { data?: { id: string; url: string }; error?: string };
    if (!reg.ok || !body.data) throw new Error(`Enregistrement refusé (${reg.status}) : ${body.error ?? "réponse inattendue"}`);
    return body.data;
  }
  if (presign.status !== 409) {
    const body = (await presign.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Envoi refusé (${presign.status}) : ${body.error ?? "réponse inattendue"}`);
  }

  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(data)], { type: mime }), path.basename(filePath));
  if (opts.format) form.set("format", opts.format);
  if (opts.title) form.set("title", opts.title);
  const res = await fetch(base, { method: "POST", headers: auth, body: form });
  const body = (await res.json().catch(() => ({}))) as { data?: { id: string; url: string }; error?: string };
  if (!res.ok || !body.data) throw new Error(`Envoi refusé (${res.status}) : ${body.error ?? "réponse inattendue"}`);
  return body.data;
}
