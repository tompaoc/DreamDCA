import type { UpdateHandle } from "../pwa";

/**
 * "A new version is ready" — a diegetic wooden strip, not a browser-chrome
 * toast. Nothing reloads until the user taps it (see pwa.ts for why).
 */
export function UpdateBanner({ handle, onDismiss }: { handle: UpdateHandle; onDismiss: () => void }) {
  return (
    <div className="update-banner">
      <span>มีเวอร์ชันใหม่ของ Dream DCA</span>
      <button type="button" className="btn btn-primary" onClick={handle.apply}>
        อัปเดตตอนนี้
      </button>
      <button type="button" className="btn btn-ghost" onClick={onDismiss} aria-label="ปิด">
        ✕
      </button>
    </div>
  );
}
