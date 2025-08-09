import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // deno-lint-ignore require-await
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*", // Proxy to Express
      },
    ];
  },
};

export default nextConfig;
