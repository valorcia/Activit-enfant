import { toLocalInput } from "@/lib/admin/form-utils";

export interface CampaignFormValues {
  id?: string; name: string; slug: string; productId: string; objective: string; channel: "META" | "TIKTOK" | "OTHER"; status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
  utmSource: string; utmMedium: "social" | "paid"; startsAt: string; endsAt: string; dailyBudget: string; adAccountId: string; externalCampaignId: string; notes: string;
}

export function emptyCampaign(): CampaignFormValues {
  return { name: "", slug: "", productId: "", objective: "ventes", channel: "META", status: "DRAFT", utmSource: "facebook", utmMedium: "paid", startsAt: "", endsAt: "", dailyBudget: "", adAccountId: "", externalCampaignId: "", notes: "" };
}

export function campaignToForm(c: { id: string; name: string; slug: string; productId: string | null; objective: string | null; channel: "META" | "TIKTOK" | "OTHER"; status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED"; utmSource: string; utmMedium: string; startsAt: Date | null; endsAt: Date | null; dailyBudgetCents: number | null; adAccountId: string | null; externalCampaignId: string | null; notes: string | null }): CampaignFormValues {
  return { id: c.id, name: c.name, slug: c.slug, productId: c.productId ?? "", objective: c.objective ?? "", channel: c.channel, status: c.status, utmSource: c.utmSource, utmMedium: c.utmMedium === "social" ? "social" : "paid", startsAt: toLocalInput(c.startsAt), endsAt: toLocalInput(c.endsAt), dailyBudget: c.dailyBudgetCents != null ? (c.dailyBudgetCents / 100).toFixed(2) : "", adAccountId: c.adAccountId ?? "", externalCampaignId: c.externalCampaignId ?? "", notes: c.notes ?? "" };
}

