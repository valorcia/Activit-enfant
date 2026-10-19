import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core", "pg-boss", "sharp", "@prisma/client"],
  images: { unoptimized: true },
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
