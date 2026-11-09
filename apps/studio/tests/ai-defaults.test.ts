import { describe, expect, it } from "vitest";
import { defaultAiSettingsFromEnv, usesDemoProviders } from "@/lib/settings";

describe("réglages IA par défaut", () => {
  it("utilise Claude et GPT Image quand les clés existent", () => {
    const s = defaultAiSettingsFromEnv({ ANTHROPIC_API_KEY: "x", OPENAI_API_KEY: "y", NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(s.mode).toBe("api");
    expect(s.textProvider).toBe("anthropic");
    expect(s.imageProvider).toBe("openai");
    expect(usesDemoProviders(s)).toEqual({ text: false, images: false });
  });
  it("passe en copier-coller en production sans clé (jamais la démo)", () => {
    const s = defaultAiSettingsFromEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(s.mode).toBe("manual");
    expect(usesDemoProviders(s)).toEqual({ text: false, images: false });
  });
  it("copier-coller seulement pour les images si seule la clé Claude existe", () => {
    const s = defaultAiSettingsFromEnv({ ANTHROPIC_API_KEY: "x", NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(s.mode).toBe("manual");
    expect(s.manualFor).toBe("images");
    expect(usesDemoProviders(s)).toEqual({ text: false, images: false });
  });
  it("signale la démo quand elle est choisie explicitement", () => {
    const s = defaultAiSettingsFromEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(usesDemoProviders(s)).toEqual({ text: true, images: true });
  });
});
