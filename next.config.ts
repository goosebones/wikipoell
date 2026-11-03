// Next.js config. Cache Components and partial prefetching are the defaults
// this version scaffolds with, and Tailwind is compiled through Turbopack.
// Images come from the R2 garment and homepage background buckets.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Photos are served from R2 as they are, like the old app did.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "media-garment.wikipoell.com" },
      { protocol: "https", hostname: "media-background.wikipoell.com" },
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
