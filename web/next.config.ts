// Next.js config. Cache Components and partial prefetching are the defaults
// this version scaffolds with; Tailwind is compiled through Turbopack, and the
// project root is pinned to web/.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
