import type { NextConfig } from "next";

/**
 * SECURITY FIX (VULN-007): Content Security Policy Headers
 *
 * These headers protect against XSS, clickjacking, and other injection attacks.
 * Implemented as part of Phase 2 security enhancements.
 */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.devnet.solana.com https://api.mainnet-beta.solana.com wss://api.devnet.solana.com wss://api.mainnet-beta.solana.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

const nextConfig: NextConfig = {
  // SECURITY FIX (VULN-007): Apply security headers to all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

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

  // SECURITY: Disable X-Powered-By header
  poweredByHeader: false,

  // SECURITY: Enable React strict mode for better error detection
  reactStrictMode: true,
};

export default nextConfig;
