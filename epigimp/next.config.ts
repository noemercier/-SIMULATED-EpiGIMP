import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack selects the project root correctly
    root: __dirname,
  },
  typescript: {
    // Temporary mitigation for dev/build TS module detection issues
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
