import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@interviewlab/core', '@interviewlab/backend'],
  devIndicators: false,
};
export default config;
