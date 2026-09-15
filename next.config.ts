import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Extra dev hostname, if any. Local-only setup, so it lives in .env rather
  // than being hardcoded here.
  allowedDevOrigins: process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : [],
  images: {
    unoptimized: true,
    remotePatterns: [
      new URL(`${process.env.R2_PUBLIC_URL}/**`),
      new URL(`${process.env.R2_BACKGROUND_PUBLIC_URL}/**`),
    ],
  },
};

export default nextConfig;
