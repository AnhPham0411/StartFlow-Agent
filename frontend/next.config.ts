import path from 'node:path';
import type { NextConfig } from 'next';

const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? 'keycloak';
if (process.env.NODE_ENV === 'production' && authMode !== 'keycloak') {
  throw new Error('Production frontend requires NEXT_PUBLIC_AUTH_MODE=keycloak');
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  reactStrictMode: true,
  transpilePackages: ['@startflow/contracts'],
};

export default nextConfig;
