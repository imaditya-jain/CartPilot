/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a one-off verification build run alongside a live `next dev` server without clobbering
  // its .next assets — see `npm run build:verify` and the note under Scripts in README.md.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopifycdn.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/api/chatbot/:path*",
        headers: [{ key: "Access-Control-Allow-Credentials", value: "false" }],
      },
    ];
  },
};

export default nextConfig;
