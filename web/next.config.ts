import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
