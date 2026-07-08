import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-client",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/trpc": "http://localhost:3000",
      "/api": "http://localhost:3000",
      "/healthz": "http://localhost:3000"
    }
  }
});
