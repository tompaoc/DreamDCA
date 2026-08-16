import { registerSW } from "virtual:pwa-register";

/**
 * Service worker registration and update flow.
 *
 * `registerType: "prompt"` in vite.config.ts is deliberate: a savings tracker
 * must never swap its code out from under an open session. If a user is
 * mid-purchase-entry when a new build ships, auto-reloading would either lose
 * what they typed or yank the world out from under them. Instead a small
 * Thai banner offers the update; nothing changes until they tap it.
 *
 * The ledger itself is IndexedDB, not a Workbox-cached resource (see the
 * `globPatterns` comment in vite.config.ts), so this update flow only ever
 * swaps static app-shell files — it can never touch saved purchase data.
 */
export type UpdateHandle = { apply: () => void };

export function initPwa(onUpdateAvailable: (handle: UpdateHandle) => void): void {
  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      onUpdateAvailable({ apply: () => void updateSW(true) });
    },
    onRegisterError(error) {
      // Offline-shell registration failing is not fatal — the app still runs,
      // it just won't have a cached shell for the next fully-offline launch.
      console.warn("service worker registration failed", error);
    },
  });
}
