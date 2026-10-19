import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@interviewlab/core', '@interviewlab/backend', '@interviewlab/content'],
  devIndicators: false,
};
export default config;
