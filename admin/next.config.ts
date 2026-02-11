import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Exclude native modules from serverless bundling - they don't work on Vercel
  serverExternalPackages: ['firebase-admin'],
  // Allow movie poster images from TIX.id CDN
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'asset.tix.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
// Trigger deploy 1766131475
