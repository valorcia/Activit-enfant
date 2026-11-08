import { describe, expect, it } from "vitest";
import { AutopilotSettingsSchema } from "@/lib/schemas/settings";
import { applyOutcome, approveCurrent, approvalGateFor, beforeStage, currentStage, initStages, markStarted, resetStage, resumeStages, type Stage } from "@/lib/autopilot/stages";
import { estimateRun, illustrationCount } from "@/lib/autopilot/estimate";
import { buildMarketingBody, callMarketingAutopilot } from "@/lib/autopilot/marketing";
import { checkKitContent } from "@/lib/autopilot/quality";
import { mockTreasureHunt } from "@/lib/kits/mock";
import { TreasureHuntSchema } from "@/lib/kits/schemas";

const cfg = (over: Record<string, unknown> = {}) => AutopilotSettingsSchema.parse(over);

function runThrough(stages: Stage[], keys: string[]) {
  let s = stages;
  for (const k of keys) s = applyOutcome({ status: "RUNNING", stages: s }, k as Stage["key"], { type: "done" }, 0).stages;
  return s;
}

describe("pilote automatique — machine à états", () => {
  it("initialise 10 étapes et respecte les étapes désactivées", () => {
    const stages = initStages(cfg({ stages: { video: false, publish: false } }));
    expect(stages).toHaveLength(10);
    expect(stages.find((s) => s.key === "video")!.status).toBe("skipped");
    expect(stages.find((s) => s.key === "publish")!.status).toBe("skipped");
    // pas de boutique → pas de publicités
    expect(stages.find((s) => s.key === "ads")!.status).toBe("skipped");
  });

  it("enchaîne les étapes : terminé → relance immédiate, dernière étape → COMPLETED", () => {
    let stages = initStages(cfg());
    const t1 = applyOutcome({ status: "RUNNING", stages }, "plan", { type: "done", detail: "ok" }, 0.01);
    expect(t1.requeueSeconds).toBe(0);
    expect(currentStage(t1.stages)!.key).toBe("content");
    stages = runThrough(t1.stages, ["content", "quality", "character", "illustrations", "layout", "pdf", "publish", "video"]);
    const last = applyOutcome({ status: "RUNNING", stages }, "ads", { type: "done" }, 1);
    expect(last.status).toBe("COMPLETED");
    expect(last.requeueSeconds).toBeNull();
  });

  it("interroge les tâches longues, attend les réponses à coller et échoue proprement", () => {
    const stages = runThrough(initStages(cfg()), ["plan", "content", "quality", "character"]);
    const poll = applyOutcome({ status: "RUNNING", stages }, "illustrations", { type: "poll", detail: "3/20" }, 0);
    expect(poll.requeueSeconds).toBe(15);
    expect(poll.stages.find((s) => s.key === "illustrations")!.status).toBe("running");
    const waiting = applyOutcome({ status: "RUNNING", stages }, "illustrations", { type: "waiting_input", detail: "images", poll: true }, 0);
    expect(waiting.status).toBe("WAITING_INPUT");
    expect(waiting.requeueSeconds).toBe(30);
    const inline = applyOutcome({ status: "RUNNING", stages }, "content", { type: "waiting_input", detail: "texte", poll: false }, 0);
    expect(inline.requeueSeconds).toBeNull();
    const failed = applyOutcome({ status: "RUNNING", stages }, "illustrations", { type: "failed", error: "boom" }, 0);
    expect(failed.status).toBe("FAILED");
    expect(failed.error).toContain("boom");
  });

  it("reprise : l'étape échouée repart, les étapes terminées sont conservées (idempotence)", () => {
    const stages = runThrough(initStages(cfg()), ["plan", "content"]);
    const failed = applyOutcome({ status: "RUNNING", stages }, "quality", { type: "failed", error: "x" }, 0).stages;
    const resumed = resumeStages(failed);
    expect(resumed.find((s) => s.key === "quality")!.status).toBe("pending");
    expect(resumed.find((s) => s.key === "plan")!.status).toBe("done");
    expect(currentStage(resumed)!.key).toBe("quality");
    const reset = resetStage(runThrough(resumed, ["quality"]), "quality");
    expect(currentStage(reset)!.key).toBe("quality");
  });

  it("calcule le coût d'une étape depuis le coût cumulé au démarrage", () => {
    let stages = initStages(cfg());
    stages = markStarted(stages, "plan", 0.5);
    stages = markStarted(stages, "plan", 0.9); // reprise : le coût de départ est conservé
    const t = applyOutcome({ status: "RUNNING", stages }, "plan", { type: "done" }, 0.75);
    expect(t.stages.find((s) => s.key === "plan")!.costUsd).toBeCloseTo(0.25);
  });

  it("points de validation et plafond de coût", () => {
    const c = cfg({ approvals: { afterContent: true }, maxCostUsd: 5 });
    const stages = runThrough(initStages(c), ["plan", "content"]);
    const quality = currentStage(stages)!;
    expect(beforeStage(quality, c, 0, 0).type).toBe("approval");
    const approved = currentStage(approveCurrent(applyOutcome({ status: "RUNNING", stages }, "quality", { type: "approval", reason: "r" }, 0).stages))!;
    expect(approved.approved).toBe(true);
    expect(beforeStage(approved, c, 0, 0).type).toBe("run");
    // plafond : 4,50 $ dépensés + 1 $ estimé > 5 $
    const illus = { ...quality, key: "illustrations" as const, label: "Illustrations", approved: false, status: "pending" as const };
    expect(beforeStage(illus, c, 4.5, 1).type).toBe("approval");
    expect(beforeStage(illus, c, 1, 1).type).toBe("run");
    // posts programmés automatiquement → validation avant les publicités par défaut
    expect(approvalGateFor("ads", cfg({ postsMode: "auto" }))).not.toBeNull();
    expect(approvalGateFor("ads", cfg({ postsMode: "draft" }))).toBeNull();
    expect(approvalGateFor("ads", cfg({ postsMode: "auto", approvals: { beforeAds: false } }))).toBeNull();
  });
});

describe("pilote automatique — estimation de coût", () => {
  const ai = { mode: "api" as const, manualFor: "all" as const, textProvider: "anthropic" as const, textModel: "claude-opus-5-5", imageProvider: "openai" as const, imageModel: "gpt-image-1", imageQuality: "medium" as const };
  it("compte les illustrations d'un kit (emplacements, éléments, visuels marketing, couverture)", () => {
    expect(illustrationCount("treasure_hunt", 10)).toBe(17);
    expect(illustrationCount("pranks", 30)).toBe(36);
  });
  it("estime texte + images + clip Runway, et 0 en copier-coller", () => {
    const a = estimateRun({ format: "treasure_hunt", count: 10, contentProvided: false, ai, autopilot: cfg({ clipProvider: "runway", videoFormats: ["story", "square"] }), runwayUsdPerSecond: 0.05 });
    expect(a.stages.illustrations).toBeGreaterThan(0.5);
    expect(a.stages.video).toBeCloseTo(0.5);
    expect(a.totalUsd).toBeGreaterThan(a.stages.illustrations!);
    const imported = estimateRun({ format: "treasure_hunt", count: 10, contentProvided: true, ai, autopilot: cfg(), runwayUsdPerSecond: 0.05 });
    expect(imported.stages.content).toBe(0);
    expect(imported.stages.plan).toBe(0);
    const manual = estimateRun({ format: "pranks", count: 30, contentProvided: false, ai: { ...ai, mode: "manual" }, autopilot: cfg(), runwayUsdPerSecond: 0.05 });
    expect(manual.totalUsd).toBe(0);
  });
});

describe("pilote automatique — client marketing de la boutique", () => {
  const shop = { baseUrl: "https://boutique.test", apiKey: "key" };
  const body = buildMarketingBody({ title: "Kit", channels: ["instagram"], variantsPerChannel: 2, videoUrls: ["https://v/1.mp4"], copy: null, dailyBudgetCents: 1000, postsMode: "auto", startOffsetHours: 24, spacingHours: 12, now: new Date("2026-11-08T10:00:00Z") });
  const reply = (status: number, json: unknown) => async (url: string, init?: RequestInit) => {
    expect(url).toBe("https://boutique.test/api/v1/products/p1/marketing/autopilot");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer key");
    return new Response(typeof json === "string" ? json : JSON.stringify(json), { status });
  };

  it("construit la demande (programmation, budget, vidéos)", () => {
    expect(body.schedule).toEqual({ mode: "auto", startAt: "2026-11-09T10:00:00.000Z", spacingHours: 12 });
    expect(body.campaign?.dailyBudgetCents).toBe(1000);
    expect(body.videoUrls).toEqual(["https://v/1.mp4"]);
  });
  it("201 → campagne créée", async () => {
    const r = await callMarketingAutopilot(shop, "p1", body, reply(201, { data: { campaignId: "c", campaignSlug: "kit", landingUrl: "u", adminUrl: "a", posts: [], generatedBy: "claude" } }));
    expect(r.kind).toBe("ok");
  });
  it("409 copywriter_unavailable → prompt à traiter par le studio (IA ou « À coller »)", async () => {
    const r = await callMarketingAutopilot(shop, "p1", body, reply(409, { error: "copywriter_unavailable", details: { prompt: "Écris…", schema: { type: "object" } } }));
    expect(r).toEqual({ kind: "needs_copy", prompt: "Écris…", schema: { type: "object" } });
  });
  it("422 → textes refusés", async () => {
    const r = await callMarketingAutopilot(shop, "p1", body, reply(422, { error: "copy invalide", details: { path: "x" } }));
    expect(r.kind).toBe("invalid");
  });
  it("404 sans JSON → boutique sans pilote marketing", async () => {
    const r = await callMarketingAutopilot(shop, "p1", body, reply(404, "<html>404</html>"));
    expect(r.kind).toBe("missing_endpoint");
  });
  it("404 JSON (produit introuvable) → erreur", async () => {
    await expect(callMarketingAutopilot(shop, "p1", body, reply(404, { error: "Produit introuvable" }))).rejects.toThrow("Produit introuvable");
  });
});

describe("pilote automatique — contrôles qualité", () => {
  const base = TreasureHuntSchema.parse(mockTreasureHunt({ title: "Chasse test", count: 10, heroName: "Professeure Fossile", companion: "Pépite" } as never));
  it("accepte un contenu complet et corrige ce qui est sûr", () => {
    const c = structuredClone(base);
    c.enigmes[0].indice_secours = "";
    c.enigmes[3].numero = 42;
    const r = checkKitContent(c, { expectedCount: 10, companion: "Pépite" });
    expect(r.ok).toBe(true);
    const fixed = r.content as typeof base;
    expect(fixed.enigmes[0].indice_secours).toContain("Pépite");
    expect(fixed.enigmes.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.fixes.length).toBeGreaterThan(0);
  });
  it("bloque un contenu incomplet, une marque ou un faux avis", () => {
    expect(checkKitContent({ ...base, enigmes: base.enigmes.slice(0, 7) }, { expectedCount: 10 }).ok).toBe(false);
    expect(checkKitContent({ ...base, lettre: base.lettre + " Comme dans Pat'Patrouille !" }, { expectedCount: 10 }).ok).toBe(false);
    const fake = checkKitContent({ ...base, boutique: { ...(base.boutique ?? {}), shortDescription: "Déjà 2 000 familles ravies !" } }, { expectedCount: 10 });
    expect(fake.ok).toBe(false);
    expect(fake.issues[0].message).toMatch(/faux avis|invérifiable/);
  });
});
