import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { adPropsSchema, parseAdProps, sceneTimings, formatPrice } from "../src/schema";
import { buildAnimationPrompt, COQUELICOT_EXAMPLE } from "../src/prompts";
import { RunwayProvider, RUNWAY_RATIOS } from "../src/providers/runway";
import { ManualVideoProvider } from "../src/providers/manual";
import { ManualVideoRequiredError, waitForVideo } from "../src/providers/types";
import { MockVideoProvider } from "../src/providers/mock";
import { adPropsFromProduct } from "../src/product";

const base = {
  title: "Le trésor de la Capitaine Coquelicot",
  hook: "Une chasse au trésor prête en 20 minutes !",
  bullets: ["10 énigmes en 2 versions"],
  priceCents: 990,
  heroImage: "cover.jpg",
};

describe("props", () => {
  it("applique les valeurs par défaut", () => {
    const p = parseAdProps(base);
    expect(p.format).toBe("story");
    expect(p.durationSeconds).toBe(15);
    expect(p.cta).toBe("Téléchargez maintenant");
  });
  it("refuse un prix barré inférieur au prix", () => {
    expect(() => parseAdProps({ ...base, compareAtCents: 500 })).toThrow();
  });
  it("refuse plus de 3 puces et une durée hors bornes", () => {
    expect(adPropsSchema.safeParse({ ...base, bullets: ["a", "b", "c", "d"] }).success).toBe(false);
    expect(adPropsSchema.safeParse({ ...base, durationSeconds: 40 }).success).toBe(false);
  });
  it("découpe les scènes sur la durée exacte", () => {
    const t = sceneTimings(15, true);
    expect(t.hook + t.kit + t.benefits + t.offer).toBe(450);
    const noKit = sceneTimings(6, false);
    expect(noKit.kit).toBe(0);
    expect(noKit.hook + noKit.benefits + noKit.offer).toBe(180);
  });
  it("formate les prix en euros", () => {
    expect(formatPrice(990).replace(/\s/g, " ")).toBe("9,90 €");
  });
});

describe("Runway", () => {
  it("construit la requête image → vidéo", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "task_123" }), { status: 200 }));
    const runway = new RunwayProvider({ apiKey: "key_test", fetchImpl: fetchImpl as unknown as typeof fetch });
    const { jobId } = await runway.generateFromImage({ imageUrl: "https://exemple.fr/a.png", prompt: "Slow push-in", durationSeconds: 5, ratio: "portrait" });
    expect(jobId).toBe("task_123");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.dev.runwayml.com/v1/image_to_video");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer key_test");
    expect(headers["X-Runway-Version"]).toBe("2024-11-06");
    expect(JSON.parse(init.body as string)).toEqual({ model: "gen4_turbo", promptImage: "https://exemple.fr/a.png", promptText: "Slow push-in", ratio: RUNWAY_RATIOS.portrait, duration: 5 });
  });
  it("convertit une image locale en data URI et refuse le http", () => {
    const runway = new RunwayProvider({ apiKey: "k" });
    const body = runway.buildRequestBody({ imageBuffer: Buffer.from("abc"), imageMime: "image/png", prompt: "p", durationSeconds: 10, ratio: "square" });
    expect(body.promptImage).toBe("data:image/png;base64,YWJj");
    expect(body.ratio).toBe("960:960");
    expect(() => runway.buildRequestBody({ imageUrl: "http://x.fr/a.png", prompt: "p", durationSeconds: 5, ratio: "square" })).toThrow();
  });
  it("suit la tâche jusqu'au MP4", async () => {
    const states = [{ status: "RUNNING", progress: 0.4 }, { status: "SUCCEEDED", output: ["https://cdn.runway/clip.mp4"] }];
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(states.shift()), { status: 200 }));
    const runway = new RunwayProvider({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const final = await waitForVideo(runway, "task_1", { intervalMs: 1 });
    expect(final).toMatchObject({ status: "succeeded", videoUrl: "https://cdn.runway/clip.mp4" });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.dev.runwayml.com/v1/tasks/task_1");
  });
  it("signale une erreur de l'API", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Not enough credits" }), { status: 400 }));
    const runway = new RunwayProvider({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(runway.generateFromImage({ imageUrl: "https://a.fr/a.png", prompt: "p", durationSeconds: 5, ratio: "portrait" })).rejects.toThrow(/Not enough credits/);
  });
  it("estime le coût (0,05 $/s par défaut)", () => {
    expect(new RunwayProvider({ apiKey: "k" }).estimateCostUsd(10)).toBe(0.5);
  });
});

describe("modes manuel et factice", () => {
  it("le mode manuel renvoie des instructions avec le prompt", async () => {
    const m = new ManualVideoProvider();
    const err = await m.generateFromImage({ imageUrl: "https://a.fr/a.png", prompt: "PROMPT-X", durationSeconds: 5, ratio: "portrait" }).catch((e) => e);
    expect(err).toBeInstanceOf(ManualVideoRequiredError);
    expect((err as ManualVideoRequiredError).instructions).toContain("PROMPT-X");
    expect((err as ManualVideoRequiredError).instructions).toContain("9:16");
  });
  it("le mode factice aboutit immédiatement", async () => {
    const mock = new MockVideoProvider("file:///clip.mp4");
    const { jobId } = await mock.generateFromImage({ imageUrl: "https://a.fr/a.png", prompt: "p", durationSeconds: 5, ratio: "square" });
    expect(await waitForVideo(mock, jobId)).toMatchObject({ status: "succeeded", videoUrl: "file:///clip.mp4" });
  });
});

describe("prompts d'animation", () => {
  it("garde le style et interdit le texte", () => {
    const p = buildAnimationPrompt({ description: "un petit tricératops dans une forêt", universe: "Dinosaures" });
    expect(p).toMatch(/watercolor/);
    expect(p).toMatch(/No text/);
    expect(p).toMatch(/dinosaur wiggles its tail|little dinosaur/);
    expect(COQUELICOT_EXAMPLE).toMatch(/parrot/);
    expect(COQUELICOT_EXAMPLE.length).toBeLessThan(1000);
  });
});

describe("fiche produit → publicité", () => {
  it("utilise les vraies données (prix promo, kit, images absolues)", () => {
    const props = adPropsFromProduct(
      {
        id: "p1", slug: "tresor", name: "Le trésor", tagline: "Accroche", priceCents: 990, salePriceCents: 790, currency: "EUR",
        kitContents: [{ title: "cartes énigmes", quantity: 10 }, { title: "Lettre" }], sellingPoints: [{ title: "Prêt en 20 min" }],
        images: [{ url: "/images/seed/cover.webp", role: "MAIN" }, { url: "/images/seed/p1.webp", role: "GALLERY" }],
      },
      "https://boutique.exemple.fr",
    );
    const p = parseAdProps(props);
    expect(p.priceCents).toBe(790);
    expect(p.compareAtCents).toBe(990);
    expect(p.coverImage).toBe("https://boutique.exemple.fr/images/seed/cover.webp");
    expect(p.kitItems[0]).toEqual({ title: "10 cartes énigmes", image: "https://boutique.exemple.fr/images/seed/p1.webp" });
    expect(p.url).toBe("boutique.exemple.fr");
  });
  it("refuse un produit sans image", () => {
    expect(() => adPropsFromProduct({ id: "p", slug: "s", name: "N", priceCents: 100, images: [] }, "https://a.fr")).toThrow(/aucune image/);
  });
});

describe("rendu réel", () => {
  it("rend une vidéo AdStory de 2 s en 360×640 avec une image locale", async () => {
    const { renderAd } = await import("../src/render");
    const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "malle-video-test-"));
    fs.copyFileSync(path.join(__dirname, "fixture-cover.jpg"), path.join(publicDir, "cover.jpg"));
    const out = path.join(publicDir, "out.mp4");
    await renderAd(
      { ...base, durationSeconds: 2, kitItems: [{ title: "Lettre", image: "cover.jpg" }, { title: "Carte" }], bullets: ["10 énigmes", "PDF A4"], logo: "cover.jpg" },
      { format: "story", outPath: out, publicDir, scale: 1 / 3, crf: 30 },
    );
    expect(fs.statSync(out).size).toBeGreaterThan(10_000);
    const probe = (() => {
      try {
        return execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name", "-of", "csv=p=0", out]).toString().trim();
      } catch {
        return null;
      }
    })();
    if (probe) expect(probe.replace(/,+$/, "")).toBe("h264,360,640");
  });
});
