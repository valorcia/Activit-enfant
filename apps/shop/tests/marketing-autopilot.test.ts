import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
// Aucune clé Claude par défaut : le chemin « copier-coller » est testé explicitement
vi.mock("@/lib/social/copywriter-claude", () => ({ isClaudeConfigured: vi.fn(async () => false), generateWithClaude: vi.fn() }));

import { sha256 } from "@/lib/tokens";
import { resetRateLimits } from "@/lib/api/auth";
import { campaignChannelFor, formatFor, pickVideos, selectVariants } from "@/lib/social/autopilot";
import { db, resetDb, createProductFixture } from "./helpers/db";

let POST: typeof import("@/app/api/v1/products/[id]/marketing/autopilot/route").POST;
let GET: typeof import("@/app/api/v1/products/[id]/marketing/route").GET;

beforeAll(async () => {
  ({ POST } = await import("@/app/api/v1/products/[id]/marketing/autopilot/route"));
  ({ GET } = await import("@/app/api/v1/products/[id]/marketing/route"));
});
beforeEach(async () => { await resetDb(); resetRateLimits(); });
afterAll(async () => { await db.$disconnect(); });

async function apiKey(scopes = ["products:write"]) {
  const secret = `cc_${Math.random().toString(36).slice(2)}`;
  await db.apiKey.create({ data: { name: "Studio", prefix: secret.slice(0, 8), keyHash: sha256(secret), scopes } });
  return secret;
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (key: string, body: unknown) => new Request("http://test/api", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });

function copy(channels: string[], n = 2) {
  return {
    variants: channels.flatMap((channel) => Array.from({ length: n }, (_, i) => ({
      channel, label: `Angle ${i + 1}`, hook: `Accroche ${channel} ${i + 1}`, body: `Texte ${channel} ${i + 1}`, cta: "Téléchargez le kit", headline: null, hashtags: ["chasseautresor", "#anniversaire"], imageIndex: 0,
    }))),
  };
}

async function connect(kind: "PAGE" | "INSTAGRAM" | "TIKTOK") {
  return db.socialAccount.create({ data: { provider: kind === "TIKTOK" ? "TIKTOK" : "META", kind, externalId: `ext-${kind}`, name: `Compte ${kind}`, accessTokenEnc: "chiffré" } });
}

describe("règles de l'autopilote", () => {
  it("choisit le canal de campagne", () => {
    expect(campaignChannelFor(["instagram", "facebook"])).toBe("META");
    expect(campaignChannelFor(["tiktok"])).toBe("TIKTOK");
    expect(campaignChannelFor(["instagram", "tiktok"])).toBe("OTHER");
  });
  it("affecte la vidéo story aux formats verticaux et l'image au fil Facebook", () => {
    const v = { story: "https://cdn/x-story.mp4", square: "https://cdn/x-square.mp4" };
    expect(formatFor("instagram", v)).toEqual({ format: "REEL_COVER", videoUrl: v.story });
    expect(formatFor("tiktok", v)).toEqual({ format: "TIKTOK_VIDEO", videoUrl: v.story });
    expect(formatFor("facebook", v)).toEqual({ format: "FEED_IMAGE", videoUrl: null });
    expect(formatFor("tiktok", { story: null, square: null })).toEqual({ format: "TIKTOK_PHOTO", videoUrl: null });
  });
  it("prend la vidéo la plus récente par format", () => {
    const older = { url: "a.mp4", alt: "[story] A", width: 1080, height: 1920, createdAt: new Date("2026-01-01") };
    const newer = { url: "b.mp4", alt: "[story] B", width: 1080, height: 1920, createdAt: new Date("2026-02-01") };
    const sq = { url: "c.mp4", alt: null, width: 1080, height: 1080, createdAt: new Date("2026-01-15") };
    expect(pickVideos([], [older, newer, sq])).toEqual({ story: "b.mp4", square: "c.mp4" });
    expect(pickVideos(["https://x/fourni.mp4"], [newer]).story).toBe("https://x/fourni.mp4");
  });
  it("limite le nombre de variantes par canal", () => {
    const vs = copy(["instagram", "tiktok"], 3).variants as never;
    expect(selectVariants(vs, ["instagram", "tiktok"], 2)).toHaveLength(4);
  });
});

describe("POST /api/v1/products/:id/marketing/autopilot", () => {
  it("copy fourni → campagne API + posts brouillons tracés", async () => {
    const key = await apiKey();
    const p = await createProductFixture({ slug: "tresor-test" });
    const res = await POST(post(key, { channels: ["instagram", "facebook"], variantsPerChannel: 2, copy: copy(["instagram", "facebook"]) }), ctx(p.slug));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.generatedBy).toBe("provided");
    expect(data.posts).toHaveLength(4);
    expect(data.posts.every((x: { status: string }) => x.status === "DRAFT")).toBe(true);
    expect(data.landingUrl).toContain(`utm_campaign=${data.campaignSlug}`);
    const campaign = await db.campaign.findUniqueOrThrow({ where: { id: data.campaignId }, include: { posts: true } });
    expect(campaign.source).toBe("api");
    expect(campaign.channel).toBe("META");
    for (const sp of campaign.posts) {
      const u = new URL(sp.linkUrl!);
      expect(u.searchParams.get("utm_content")).toBe(sp.id);
      expect(["instagram", "facebook"]).toContain(u.searchParams.get("utm_source"));
      expect(sp.hashtags.every((h) => h.startsWith("#"))).toBe(true);
    }
    const audit = await db.auditLog.findFirst({ where: { action: "campaign.autopilot" } });
    expect(audit?.actor).toMatch(/^api:cc_/);
  });

  it("mode auto + compte connecté → posts programmés et espacés", async () => {
    const key = await apiKey();
    const p = await createProductFixture();
    await connect("INSTAGRAM");
    await db.productImage.create({ data: { productId: p.id, url: "https://cdn/story.mp4", role: "VIDEO", alt: "[story] Pub", width: 1080, height: 1920 } });
    const startAt = "2026-12-01T09:00:00.000Z";
    const res = await POST(post(key, { channels: ["instagram", "tiktok"], copy: copy(["instagram", "tiktok"]), schedule: { mode: "auto", startAt, spacingHours: 12 } }), ctx(p.id));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    const ig = data.posts.filter((x: { channel: string }) => x.channel === "instagram");
    const tk = data.posts.filter((x: { channel: string }) => x.channel === "tiktok");
    expect(ig.map((x: { status: string }) => x.status)).toEqual(["SCHEDULED", "SCHEDULED"]);
    expect(ig.map((x: { scheduledAt: string }) => x.scheduledAt)).toEqual([startAt, "2026-12-01T21:00:00.000Z"]);
    expect(ig[0].accountName).toBe("Compte INSTAGRAM");
    expect(ig[0].format).toBe("REEL_COVER");
    // Pas de compte TikTok connecté : brouillon, mais vidéo story bien affectée
    expect(tk.every((x: { status: string; format: string }) => x.status === "DRAFT" && x.format === "TIKTOK_VIDEO")).toBe(true);
    const stored = await db.socialPost.findMany({ where: { campaignId: data.campaignId } });
    expect(stored.every((s) => s.videoUrl === "https://cdn/story.mp4")).toBe(true);
    expect((await db.campaign.findUniqueOrThrow({ where: { id: data.campaignId } })).channel).toBe("OTHER");
  });

  it("sans clé Claude et sans copy → 409 avec le prompt à coller", async () => {
    const key = await apiKey();
    const p = await createProductFixture({ name: "Le trésor de test" });
    const res = await POST(post(key, { channels: ["tiktok"] }), ctx(p.id));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("copywriter_unavailable");
    expect(body.details.prompt).toContain("Le trésor de test");
    expect(body.details.prompt).toContain("tiktok");
    expect(body.details.schema).toContain("variants");
    expect(await db.campaign.count()).toBe(0);
  });

  it("copy invalide → 422 lisible", async () => {
    const key = await apiKey();
    const p = await createProductFixture();
    const res = await POST(post(key, { channels: ["instagram"], copy: { variants: [{ channel: "instagram", hook: "x" }] } }), ctx(p.id));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.details.issues.length).toBeGreaterThan(0);
    expect(await db.campaign.count()).toBe(0);
  });

  it("produit non publié → campagne et posts en brouillon même en mode auto", async () => {
    const key = await apiKey();
    const p = await createProductFixture({ status: "DRAFT" });
    await connect("PAGE");
    const res = await POST(post(key, { channels: ["facebook"], copy: copy(["facebook"], 1), schedule: { mode: "auto" } }), ctx(p.id));
    const { data } = await res.json();
    expect(data.posts[0].status).toBe("DRAFT");
    expect((await db.campaign.findUniqueOrThrow({ where: { id: data.campaignId } })).status).toBe("DRAFT");
  });

  it("refuse une clé en lecture seule et un produit inconnu", async () => {
    const ro = await apiKey(["products:read"]);
    const p = await createProductFixture();
    expect((await POST(post(ro, { channels: ["instagram"], copy: copy(["instagram"]) }), ctx(p.id))).status).toBe(403);
    const key = await apiKey();
    expect((await POST(post(key, { channels: ["instagram"], copy: copy(["instagram"]) }), ctx("inconnu"))).status).toBe(404);
  });
});

describe("GET /api/v1/products/:id/marketing", () => {
  it("liste les campagnes avec posts et stats", async () => {
    const key = await apiKey();
    const p = await createProductFixture();
    await POST(post(key, { channels: ["instagram"], copy: copy(["instagram"], 1) }), ctx(p.id));
    const res = await GET(new Request("http://test", { headers: { authorization: `Bearer ${key}` } }), ctx(p.slug));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.campaigns).toHaveLength(1);
    expect(data.campaigns[0].posts).toHaveLength(1);
    expect(data.campaigns[0].stats).toMatchObject({ orders: 0, revenueCents: 0, spendCents: 0, roas: null });
  });
});
