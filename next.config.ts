import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      new URL(`${process.env.R2_PUBLIC_URL}/**`),
      new URL(`${process.env.R2_BACKGROUND_PUBLIC_URL}/**`),
      new URL(`https://thelibrary1994.com/**`),
    ],
  },
};

export default nextConfig;
