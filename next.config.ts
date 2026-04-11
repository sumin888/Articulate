import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@mozilla/readability", "jsdom"],
  // Avoid turbopack.root === this project dir on Next 16: it can break `tailwindcss` CSS resolution
  // (resolver uses the parent folder’s package.json, e.g. ~/Documents, where tailwind isn’t installed).
};

export default nextConfig;
