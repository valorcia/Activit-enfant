import type { ImageProvider, TextProvider } from "./types";
import type { AiSettings } from "../schemas/settings";
import { AnthropicTextProvider } from "./text/anthropic";
import { OpenAITextProvider } from "./text/openai";
import { MockTextProvider } from "./text/mock";
import { OpenAIImageProvider } from "./image/openai";
import { MockImageProvider } from "./image/mock";

export function getTextProvider(settings: AiSettings): TextProvider {
  switch (settings.textProvider) {
    case "anthropic":
      return new AnthropicTextProvider();
    case "openai":
      return new OpenAITextProvider();
    default:
      return new MockTextProvider();
  }
}

export function getImageProvider(settings: AiSettings): ImageProvider {
  switch (settings.imageProvider) {
    case "openai":
      return new OpenAIImageProvider();
    default:
      return new MockImageProvider();
  }
}

export function effectiveTextModel(settings: AiSettings) {
  return settings.textProvider === "mock" ? "mock" : settings.textModel;
}
export function effectiveImageModel(settings: AiSettings) {
  return settings.imageProvider === "mock" ? "mock" : settings.imageModel;
}
