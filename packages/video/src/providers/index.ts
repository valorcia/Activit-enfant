import { ManualVideoProvider } from "./manual";
import { MockVideoProvider } from "./mock";
import { RunwayProvider } from "./runway";
import type { VideoProvider } from "./types";

export * from "./types";
export { RunwayProvider, RUNWAY_DEFAULTS, RUNWAY_RATIOS } from "./runway";
export { ManualVideoProvider } from "./manual";
export { MockVideoProvider } from "./mock";

export type VideoProviderName = "runway" | "manual" | "mock";

/** Fabrique de fournisseurs. Veo / Sora s'ajouteront ici derrière la même interface. */
export function createVideoProvider(name: VideoProviderName, env: Record<string, string | undefined> = process.env): VideoProvider {
  switch (name) {
    case "runway":
      return new RunwayProvider({ apiKey: env.RUNWAY_API_KEY ?? "" });
    case "manual":
      return new ManualVideoProvider();
    case "mock":
      return new MockVideoProvider();
  }
}
