import type { NextConfig } from "next";

// Every screen depends on the signed-in user, so the app renders per request
// (previous caching model, without Cache Components).
const nextConfig: NextConfig = {
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
