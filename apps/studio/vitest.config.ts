import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Composants React (.tsx) importés par les tests de rendu : JSX transformé par le runtime automatique
  // (le tsconfig garde « jsx: preserve » pour Next.js).
  oxc: { jsx: { runtime: "automatic" } },
});
