import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { WorldScene } from "./scenes/WorldScene";
import { applyViewport, computeViewport } from "./scale";

/**
 * Mounts Phaser on the World screen only. Phaser never owns financial data —
 * it reads a snapshot of world state from the store (AUDIT §2).
 *
 * Scale mode is NONE on purpose. `Phaser.Scale.FIT` produces fractional scales,
 * which is exactly the blur L3 forbids; the integer geometry is computed in
 * `scale.ts` and applied here.
 */
export function PhaserGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // StrictMode mounts, unmounts, then remounts. Creating the game in a deferred
    // task and cancelling on unmount means the throwaway mount never boots a game
    // at all — destroying a half-booted Phaser.Game leaves its canvas in the DOM,
    // and that stale canvas then sits on top of the live one.
    let game: Phaser.Game | null = null;
    let cancelled = false;

    const layout = () => {
      if (!game) return;
      const v = computeViewport(window.innerWidth, window.innerHeight);
      game.scale.resize(v.internalW, v.internalH);
      if (game.canvas) applyViewport(game.canvas, v);
      const scene = game.scene.getScene("world") as WorldScene | null;
      scene?.onResize?.(v.internalH);
    };

    const boot = () => {
      if (cancelled) return;
      const initial = computeViewport(window.innerWidth, window.innerHeight);

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host,
        width: initial.internalW,
        height: initial.internalH,
        backgroundColor: "#2E5227",
        pixelArt: true,
        roundPixels: true,
        antialias: false,
        scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
        physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
        scene: [WorldScene],
      });

      game.events.once(Phaser.Core.Events.READY, layout);

      // Dev-only handle, so the rendered frame can be probed from the console
      // (palette conformance, depth ordering) instead of eyeballed.
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__dd = game;
      }
    };

    const bootTimer = window.setTimeout(boot, 0);
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", layout);

    return () => {
      cancelled = true;
      window.clearTimeout(bootTimer);
      window.removeEventListener("resize", layout);
      window.removeEventListener("orientationchange", layout);
      game?.destroy(true);
      game = null;
    };
  }, []);

  return <div className="world-host" ref={hostRef} />;
}

export default PhaserGame;
