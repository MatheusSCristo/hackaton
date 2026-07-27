import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite não injeta o .env em `process.env` (só em `import.meta.env` do
  // client) — precisamos carregar explicitamente pra configurar o próprio
  // dev server (porta e proxy).
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  return {
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
      port: env.VITE_PORT ? Number(env.VITE_PORT) : 9000,
      // Docker + bind mount no Windows não propaga eventos de filesystem
      // para o container Linux; polling garante que o watcher (chokidar)
      // detecte mudanças e o HMR dispare. Ver CHOKIDAR_USEPOLLING no compose.
      watch: {
        usePolling: true,
        interval: 300,
      },
      // `VITE_HACKATON_API_URL` vazio = caminho relativo; o proxy resolve
      // pro backend NestJS local. Em produção, defina a variável com a URL
      // do gateway e o front chama direto (sem passar pelo proxy do Vite).
      proxy: env.VITE_HACKATON_API_URL
        ? undefined
        : {
            "/api": {
              target: "http://localhost:8000",
              changeOrigin: true,
            },
          },
    },
  };
});
