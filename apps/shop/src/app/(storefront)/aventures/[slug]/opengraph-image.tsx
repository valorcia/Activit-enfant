import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { effectivePrice } from "@/lib/pricing";
import { formatAgeRange, formatPrice } from "@/lib/utils";

export const runtime = "nodejs";
export const alt = "Aperçu du produit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image Open Graph générée pour chaque fiche produit (utilisée quand aucune image OG n'est définie). */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, { brand, theme }] = await Promise.all([
    prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { name: true, tagline: true, ageMin: true, ageMax: true, priceCents: true, salePriceCents: true, saleStartsAt: true, saleEndsAt: true, currency: true, category: { select: { name: true } } } }),
    getSettings(),
  ]);
  const c = theme.colors;
  const price = product ? effectivePrice(product) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c.cream, fontFamily: "sans-serif", color: c.ink, position: "relative" }}>
        <div style={{ position: "absolute", right: -120, top: -140, width: 480, height: 480, borderRadius: 9999, background: c.sky, opacity: 0.8 }} />
        <div style={{ position: "absolute", left: -80, bottom: -200, width: 420, height: 420, borderRadius: 9999, background: c.honey, opacity: 0.8 }} />
        <div style={{ position: "absolute", right: 160, bottom: -60, width: 260, height: 260, borderRadius: 9999, background: c.lavender, opacity: 0.7 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: c.coral, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800 }}>{brand.name.charAt(0)}</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{brand.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 820 }}>
            {product?.category && <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: c.coral }}>{product.category.name.toUpperCase()}</div>}
            <div style={{ fontSize: product && product.name.length > 40 ? 56 : 68, fontWeight: 800, lineHeight: 1.05 }}>{product?.name ?? brand.name}</div>
            {product?.tagline && <div style={{ fontSize: 28, opacity: 0.8 }}>{product.tagline}</div>}
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {price && <div style={{ display: "flex", background: c.coral, color: "white", borderRadius: 9999, padding: "14px 32px", fontSize: 34, fontWeight: 800 }}>{formatPrice(price.priceCents, product?.currency)}</div>}
            {product && <div style={{ display: "flex", background: "white", borderRadius: 9999, padding: "14px 28px", fontSize: 26, fontWeight: 700 }}>{formatAgeRange(product.ageMin, product.ageMax)}</div>}
            <div style={{ display: "flex", background: "white", borderRadius: 9999, padding: "14px 28px", fontSize: 26, fontWeight: 700 }}>PDF à imprimer</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
