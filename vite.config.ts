import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // never swap the app out from under an open session
      injectRegister: null, // registered manually in main.tsx, after the ledger loads
      workbox: {
        // The ledger's own data (IndexedDB) is never cached by the service
        // worker — only static app shell files are. Offline means "the app
        // opens and shows what it already loaded," never "a stale ledger".
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        // Precaching is deliberately name-hashed per build, so a rebuilt
        // service worker knows exactly which old shell files to evict.
        cleanupOutdatedCaches: true,
        // 1.5MB+ Phaser chunk needs Workbox's higher precache ceiling.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        id: "/",
        name: "Dream DCA — BTC Homestead",
        short_name: "Dream DCA",
        description:
          "บันทึกการซื้อ BTC จริง แล้วดูบ้าน pixel art ของคุณเติบโตขึ้นทีละวัน",
        lang: "th",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "portrait",
        // Palette ink/grass — matches the boot screen and the world background,
        // so there is no flash of a mismatched colour around the splash icon.
        background_color: "#140F14",
        theme_color: "#140F14",
        categories: ["finance", "games", "lifestyle"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  // zustand reaches React through use-sync-external-store's shim. Without this,
  // a stale pre-bundle can hand it a second React instance and every hook call
  // in the app throws "Invalid hook call".
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "zustand", "dexie"] },
  server: { host: true, port: 5173 },
  build: { target: "es2022" },
});
