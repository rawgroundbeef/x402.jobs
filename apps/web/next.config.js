/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    formats: ["image/webp", "image/avif"],
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Proxy API requests to the Express API backend
  async rewrites() {
    const apiUrl =
      process.env.NEXT_PUBLIC_AGENTS_API_URL || "http://localhost:3006";
    const mainApiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    return [
      // Vanity URLs: /@username -> /user/username (profile page)
      {
        source: "/@:username",
        destination: "/user/:username",
      },
      // Vanity URLs: /@username/slug -> /user/username/slug (job page)
      {
        source: "/@:username/:slug",
        destination: "/user/:username/:slug",
      },
      // X402 discovery endpoint
      {
        source: "/api/x402/:path*",
        destination: `${apiUrl}/x402/:path*`,
      },
      // Main API for job operations
      {
        source: "/api/jobs/:path*",
        destination: `${mainApiUrl}/x402-jobs/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
