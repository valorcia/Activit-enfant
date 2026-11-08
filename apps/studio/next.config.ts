import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @malle/video : seuls les sous-modules légers (prompts, schéma, envoi boutique) sont importés côté Next ;
  // le rendu Remotion tourne uniquement dans le worker.
  transpilePackages: ["@malle/video"],
  serverExternalPackages: ["playwright-core", "pg-boss", "sharp", "@prisma/client", "remotion", "@remotion/bundler", "@remotion/renderer", "@remotion/cli", "@remotion/google-fonts"],
  images: { unoptimized: true },
  devIndicators: false,
  // Téléversement des clips d'animation et des musiques (server actions)
  experimental: { serverActions: { bodySizeLimit: "200mb" } },
};

export default nextConfig;
