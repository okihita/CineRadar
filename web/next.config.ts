import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Set Turbopack root to silence multiple lockfiles warning
  turbopack: {
    root: path.join(__dirname, '..'),
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'asset.tix.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cgv.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'web3.21cineplex.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.21cineplex.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
