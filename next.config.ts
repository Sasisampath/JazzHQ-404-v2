import type { NextConfig } from "next";

// Standalone 404 prototype: static only, no rewrites, no API, no remote hosts.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
