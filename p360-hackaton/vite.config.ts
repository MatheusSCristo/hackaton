import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000, // 1mb
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@test": path.resolve(__dirname, "./__test__"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 9000,
    // Docker + bind mount no Windows não propaga eventos de filesystem
    // para o container Linux; polling garante que o watcher (chokidar)
    // detecte mudanças e o HMR dispare. Ver CHOKIDAR_USEPOLLING no compose.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
