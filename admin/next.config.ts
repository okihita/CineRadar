import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Set Turbopack root to silence multiple lockfiles warning
  turbopack: {
    root: path.join(__dirname, '..'),
  },
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
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
// Trigger deploy 1766131475
