import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/shop_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_URL_UNPOOLED: TEST_DATABASE_URL,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DOWNLOAD_TOKEN_SECRET: "test-download-secret",
      AUTH_SECRET: "test-auth-secret",
      EMAIL_DRIVER: "console",
      STORAGE_DRIVER: "local",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/helpers/server-only.ts") } },
});
