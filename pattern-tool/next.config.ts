import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Static export for embedding in Tauri (`out/`).
  output: "export",
  // Anchor Turbopack to this project so the multi-lockfile warning goes away.
  // Without this it walks up and lands on the parent package-lock.json.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
