import { centsToEuros } from "@/lib/admin/form-utils";

export interface BundleFormData {
  id?: string; name: string; slug: string; tagline: string; description: string; imageUrl: string; price: string; currency: string; taxRate: string; badges: string;
  status: string; isFeatured: boolean; seoTitle: string; seoDescription: string; productIds: string[];
}
export interface BundleProductOption { id: string; name: string; slug: string; priceCents: number; status: string }

export function emptyBundleForm(): BundleFormData {
  return { name: "", slug: "", tagline: "", description: "", imageUrl: "", price: "", currency: "EUR", taxRate: "20", badges: "", status: "DRAFT", isFeatured: false, seoTitle: "", seoDescription: "", productIds: [] };
}

export function bundleToForm(b: { id: string; name: string; slug: string; tagline: string | null; description: string | null; imageUrl: string | null; priceCents: number; currency: string; taxRateBp: number; badges: string[]; status: string; isFeatured: boolean; seoTitle: string | null; seoDescription: string | null; items: Array<{ productId: string }> }): BundleFormData {
  return { id: b.id, name: b.name, slug: b.slug, tagline: b.tagline ?? "", description: b.description ?? "", imageUrl: b.imageUrl ?? "", price: centsToEuros(b.priceCents), currency: b.currency, taxRate: String(b.taxRateBp / 100), badges: b.badges.join(", "), status: b.status, isFeatured: b.isFeatured, seoTitle: b.seoTitle ?? "", seoDescription: b.seoDescription ?? "", productIds: b.items.map((i) => i.productId) };
}
