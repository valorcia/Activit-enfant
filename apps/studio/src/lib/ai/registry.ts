import type { ImageProvider, TextProvider } from "./types";
import type { AiSettings } from "../schemas/settings";
import { AnthropicTextProvider } from "./text/anthropic";
import { OpenAITextProvider } from "./text/openai";
import { MockTextProvider } from "./text/mock";
import { OpenAIImageProvider } from "./image/openai";
import { MockImageProvider } from "./image/mock";
import { ManualTextProvider, type ManualContext } from "./text/manual";
import { ManualImageProvider } from "./image/manual";

export function manualText(settings: AiSettings) {
  return settings.mode === "manual" && settings.manualFor !== "images";
}
export function manualImages(settings: AiSettings) {
  return settings.mode === "manual" && settings.manualFor !== "text";
}

export function getTextProvider(settings: AiSettings, ctx?: ManualContext): TextProvider {
  if (manualText(settings)) return new ManualTextProvider(ctx);
  switch (settings.textProvider) {
    case "anthropic":
      return new AnthropicTextProvider();
    case "openai":
      return new OpenAITextProvider();
    default:
      return new MockTextProvider();
  }
}

export function getImageProvider(settings: AiSettings, ctx?: ManualContext): ImageProvider {
  if (manualImages(settings)) return new ManualImageProvider(ctx);
  switch (settings.imageProvider) {
    case "openai":
      return new OpenAIImageProvider();
    default:
      return new MockImageProvider();
  }
}

export function effectiveTextModel(settings: AiSettings) {
  if (manualText(settings)) return "manual";
  return settings.textProvider === "mock" ? "mock" : settings.textModel;
}
export function effectiveImageModel(settings: AiSettings) {
  if (manualImages(settings)) return "manual";
  return settings.imageProvider === "mock" ? "mock" : settings.imageModel;
}
