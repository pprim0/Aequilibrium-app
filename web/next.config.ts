import type { NextConfig } from "next";

// Every screen depends on the signed-in user, so the app renders per request
// (previous caching model, without Cache Components).
const nextConfig: NextConfig = {
  // Lets another device on the local network use the dev server.
  allowedDevOrigins: ["192.168.1.17"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
