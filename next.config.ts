import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // All photography is stored locally in /public/images, so no remote
    // patterns are required. If you later add remote images, whitelist the
    // host here via `images.remotePatterns`.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
