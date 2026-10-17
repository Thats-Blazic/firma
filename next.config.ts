import type { NextConfig } from "next";

// Destination photos uploaded from the admin panel live in Supabase Storage.
// Whitelist that host (derived from the env var) so next/image can serve them.
function supabaseImagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return [];
    const { hostname } = new URL(url);
    return [{ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Site photography is stored locally in /public/images.
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseImagePatterns(),
  },
};

export default nextConfig;
