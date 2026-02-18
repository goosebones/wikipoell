import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL(`${process.env.R2_PUBLIC_URL}/**`)],
  },
};

export default nextConfig;
