import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // Turbopack configuration
  turbopack: {
    root: __dirname, // Fix: Explicitly set workspace root to nextjs-app directory
    resolveAlias: {
      // Ensure consistent module resolution
    },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  // Ensure JSON imports work correctly
  transpilePackages: ['@coral-xyz/anchor'],
  // Allow builds despite linting/type errors (for development)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
