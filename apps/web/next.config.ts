import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@seatline/shared'],
  // The browser only talks to /api on the web origin; Next forwards it to the API.
  // Same origin = no CORS, and the API can stay private in Azure Container Apps.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:3001'}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
