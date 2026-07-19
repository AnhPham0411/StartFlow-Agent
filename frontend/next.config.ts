import path from 'node:path';
import type { NextConfig } from 'next';

const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'keycloak';
if (
  process.env.NODE_ENV === 'production' &&
  authMode !== 'keycloak' &&
  !(authMode === 'demo' && process.env.NEXT_PUBLIC_DEMO_PUBLIC_WARNING === 'true')
) {
  throw new Error(
    'Production frontend requires Keycloak, or explicit demo mode with NEXT_PUBLIC_DEMO_PUBLIC_WARNING=true.',
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  experimental: { cpus: 1 },
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  reactStrictMode: true,
  transpilePackages: ['@startflow/contracts'],
};

export default nextConfig;
