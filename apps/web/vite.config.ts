import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const backend = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": backend,
      "/auth": backend,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/testing/setup.ts"],
  },
});
