import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { ServerResponse } from "node:http";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("error", (_err, _req, res) => {
            const response = res as ServerResponse;
            if (!response.headersSent) {
              response.writeHead(502, { "Content-Type": "application/json" });
            }
            response.end(
              JSON.stringify({
                data: null,
                error: {
                  code: "API_UNAVAILABLE",
                  message:
                    "API nicht erreichbar. Starte in einem zweiten Terminal: npm run dev:api",
                },
              }),
            );
          });
        },
      },
    },
  },
});
