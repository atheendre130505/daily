import type { NextConfig } from "next";

/**
 * Daily is a static site (GitHub Pages) that talks straight to Supabase.
 * NEXT_PUBLIC_BASE_PATH is "/daily" for GitHub Pages and empty when run locally.
 */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: base || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
