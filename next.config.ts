import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [process.env.GARMENT_IMAGE_DOMAIN || ""],
  },
};

export default nextConfig;
