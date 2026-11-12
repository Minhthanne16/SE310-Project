import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Proxy /api/* mặc định chỉ chuyển 10 MB thân yêu cầu; bài nộp PDF tối đa 20 MB
    // (PDR-040) + phần đầu multipart, khớp RequestSizeLimit của OutlineController.
    proxyClientMaxBodySize: '21mb',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:5290'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
