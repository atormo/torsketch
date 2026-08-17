import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((module) =>
  module.initOpenNextCloudflareForDev(),
);
