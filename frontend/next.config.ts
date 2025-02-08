import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "tone": require.resolve("tone"),
    };
    return config;
  },
};

export default nextConfig;
