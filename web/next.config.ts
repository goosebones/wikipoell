// Next.js config. Cache Components and partial prefetching are the defaults
// this version scaffolds with; Tailwind is compiled through Turbopack, and the
// project root is pinned to web/. Images come from the R2 garment bucket.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Garment photos are already WebP on R2 and are served as they are, like
  // the old app did.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "media-garment.wikipoell.com" },
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The old app's lockfile sits one level up; without this Turbopack
    // treats the repo root as the project root.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
