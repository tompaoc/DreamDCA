import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  // zustand reaches React through use-sync-external-store's shim. Without this,
  // a stale pre-bundle can hand it a second React instance and every hook call
  // in the app throws "Invalid hook call".
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "zustand", "dexie"] },
  server: { host: true, port: 5173 },
  build: { target: "es2022" },
});
