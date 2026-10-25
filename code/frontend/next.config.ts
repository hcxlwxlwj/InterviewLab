import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const rootEnvironment = resolve(__dirname, '../../.env');
if (existsSync(rootEnvironment)) process.loadEnvFile(rootEnvironment);
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:3001';
const target = new URL(backendOrigin);
if (!['http:', 'https:'].includes(target.protocol) || target.origin !== backendOrigin)
  throw new Error('BACKEND_ORIGIN must be an HTTP origin without a path');
const config: NextConfig = {
  transpilePackages: ['@interviewlab/core', '@interviewlab/backend'],
  devIndicators: false,
  async rewrites() {
    return {
      beforeFiles: [{ source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` }],
      afterFiles: [],
      fallback: [],
    };
  },
};
export default config;
