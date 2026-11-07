import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CouponManager } from "@/components/admin/ops-coupon-manager";

export const metadata = { title: "Codes promo" };
export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  await requirePermission("coupons:write");
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div>
      <AdminPageHeader title="Codes promo" description="Codes de réduction appliqués au panier (validés côté serveur et synchronisés avec Stripe au moment du paiement)." />
      <CouponManager coupons={coupons.map((c) => ({ ...c, startsAt: c.startsAt?.toISOString() ?? null, endsAt: c.endsAt?.toISOString() ?? null, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }))} />
    </div>
  );
}
