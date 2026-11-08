import { describe, expect, it } from "vitest";
import { ManualInputRequiredError, buildBatchPrompt, buildImagePrompt, buildTextPrompt, cleanPastedJson, fingerprint, isManualInputRequired, splitBatchResponse, stripInternalBlocks, textRequestTitle } from "@/lib/ai/manual-core";
import { extractJson } from "@/lib/ai/structured";
import { AiSettingsSchema } from "@/lib/schemas/settings";
import { effectiveImageModel, effectiveTextModel, manualImages, manualText } from "@/lib/ai/registry";

describe("mode copier-coller", () => {
  it("produit une empreinte stable, indépendante de l'ordre des clés", () => {
    const a = fingerprint("TEXT", { system: "S", prompt: "P", json: true });
    const b = fingerprint("TEXT", { json: true, prompt: "P", system: "S" });
    expect(a).toBe(b);
    expect(fingerprint("TEXT", { system: "S", prompt: "P2", json: true })).not.toBe(a);
    expect(fingerprint("IMAGE", { system: "S", prompt: "P", json: true })).not.toBe(a);
  });

  it("retire les blocs internes et construit un prompt complet", () => {
    const raw = 'Rédige la fiche.\n\n<<purpose:activity>>\n<<context>>{"title":"Le volcan"}<</context>>';
    expect(stripInternalBlocks(raw)).toBe("Rédige la fiche.");
    const full = buildTextPrompt("Tu es éditeur.", raw);
    expect(full.startsWith("Tu es éditeur.")).toBe(true);
    expect(full).toContain("Rédige la fiche.");
    expect(full).toContain("uniquement avec l'objet JSON");
    expect(full).not.toContain("<<context>>");
  });

  it("donne un titre lisible à partir de la finalité et du contexte", () => {
    expect(textRequestTitle('<<purpose:activity>>\n<<context>>{"title":"Le volcan"}<</context>>')).toBe("Fiche : Le volcan");
    expect(textRequestTitle('<<purpose:outline>>\n<<context>>{"title":"Les Petits Inventeurs"}<</context>>')).toBe("Sommaire du livre : Les Petits Inventeurs");
    expect(textRequestTitle("sans balises")).toBe("Texte");
  });

  it("nettoie une réponse collée avec balises et texte autour", () => {
    const pasted = 'Voici le JSON demandé :\n```json\n{"a": 1, "b": [1,2]}\n```\nBonne journée !';
    expect(JSON.parse(cleanPastedJson(pasted))).toEqual({ a: 1, b: [1, 2] });
    expect(extractJson(cleanPastedJson(pasted))).toEqual({ a: 1, b: [1, 2] });
  });

  it("prépare un prompt image avec format et interdits", () => {
    const p = buildImagePrompt({ prompt: "Un volcan en papier mâché", negativePrompt: "texte, logo", size: "1536x1024", quality: "high" });
    expect(p).toContain("Un volcan en papier mâché");
    expect(p).toContain("paysage");
    expect(p).toContain("À éviter : texte, logo");
  });

  it("assemble et découpe un collage multi-réponses", () => {
    const prompt = buildBatchPrompt([{ id: "r1", title: "Fiche : A", prompt: "PA" }, { id: "r2", title: "Fiche : B", prompt: "PB" }]);
    expect(prompt).toContain("### DEMANDE r1");
    expect(prompt).toContain("### DEMANDE r2");
    const parts = splitBatchResponse('### DEMANDE r1\n```json\n{"x":1}\n```\n### DEMANDE r2\n{"x":2}');
    expect(parts.map((p) => p.id)).toEqual(["r1", "r2"]);
    expect(JSON.parse(cleanPastedJson(parts[0].body))).toEqual({ x: 1 });
    expect(JSON.parse(cleanPastedJson(parts[1].body))).toEqual({ x: 2 });
    expect(splitBatchResponse("rien")).toEqual([]);
  });

  it("expose une erreur typée reconnue même après sérialisation partielle", () => {
    const err = new ManualInputRequiredError("req_1", "Fiche : A", "TEXT");
    expect(isManualInputRequired(err)).toBe(true);
    expect(isManualInputRequired({ code: "MANUAL_INPUT_REQUIRED" })).toBe(true);
    expect(isManualInputRequired(new Error("autre"))).toBe(false);
    expect(err.message).toContain("Fiche : A");
  });

  it("sélectionne les fournisseurs manuels selon le mode et le périmètre", () => {
    const api = AiSettingsSchema.parse({ textProvider: "anthropic", imageProvider: "openai" });
    expect(manualText(api)).toBe(false);
    expect(effectiveTextModel(api)).toBe("claude-opus-5-5");
    const all = AiSettingsSchema.parse({ mode: "manual", textProvider: "anthropic", imageProvider: "openai" });
    expect(manualText(all) && manualImages(all)).toBe(true);
    expect(effectiveTextModel(all)).toBe("manual");
    expect(effectiveImageModel(all)).toBe("manual");
    const imagesOnly = AiSettingsSchema.parse({ mode: "manual", manualFor: "images", textProvider: "anthropic", imageProvider: "openai" });
    expect(manualText(imagesOnly)).toBe(false);
    expect(manualImages(imagesOnly)).toBe(true);
    expect(effectiveTextModel(imagesOnly)).toBe("claude-opus-5-5");
  });
});
