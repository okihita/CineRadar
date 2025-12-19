import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Exclude native modules from serverless bundling - they don't work on Vercel
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
// Trigger deploy 1766131475
