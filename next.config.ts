import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pinned so Next doesn't pick up a lockfile from a parent directory.
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "app.smartevent.rw" },
    ],
  },
};

export default nextConfig;
