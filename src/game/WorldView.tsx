import { useEffect, useRef, useState } from "react";
import type { WorldState } from "../core/types";
import { Hud, type HudModel } from "./hud";

/**
 * Renders the current world as one full painted scene (see docs/ART_PROMPTS_BTC.md)
 * instead of a walkable tile/sprite engine.
 *
 * This is the "diorama" alternative AUDIT.md §12.2 raised as an open question and
 * never settled — settled now, by the art itself: HANDOFF's L1 locks Phaser into
 * the stack, but nothing requires every world to be walkable. BTC Homestead's
 * scenes are AI-painted full compositions; compositing them from 32px tiles and
 * sprites would fight the art, not serve it. Phaser stays an installed dependency
 * per L1 — it is simply unused by this view.
 */

const assetBase = import.meta.env.BASE_URL;
const sceneUrl = (world: string, image: string) => `${assetBase}art/${world}/${image}.webp`;

function nextLabel(world: WorldState): string {
  if (!world.nextScene) return "ครบเป้าหมายแล้ว";
  const btc = (world.nextScene.minSats / 100_000_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `NEXT ${btc} BTC`;
}

function SceneLayer({ world }: { world: WorldState }) {
  const [shown, setShown] = useState(world.image);
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    if (world.image === shown) return;
    setPrev(shown);
    setShown(world.image);
    const t = window.setTimeout(() => setPrev(null), 900); // matches CSS transition below
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.image]);

  return (
    <div className="scene-stack">
      {prev ? (
        <img className="scene-img scene-img-out" src={sceneUrl(world.world, prev)} alt="" />
      ) : null}
      <img className="scene-img scene-img-in" src={sceneUrl(world.world, shown)} alt={world.label} />
    </div>
  );
}

function HudLayer({ world }: { world: WorldState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<Hud | null>(null);
  if (!hudRef.current) hudRef.current = new Hud();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const model: HudModel = {
      progressToGoal: world.progressToGoal,
      totalSats: world.totalSats,
      goalSats: world.goalSats,
      sceneLabel: world.label,
      nextLabel: nextLabel(world),
      progressToNext: world.progressToNext,
    };
    if (hudRef.current?.update(model)) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(hudRef.current.canvas, 0, 0);
    }
  }, [world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const src = hudRef.current?.canvas;
    if (canvas && src) canvas.getContext("2d")?.drawImage(src, 0, 0);
  }, []);

  return <canvas ref={canvasRef} className="hud-canvas" width={360} height={116} />;
}

export default function WorldView({ world }: { world: WorldState }) {
  return (
    <div className="world-view">
      <SceneLayer world={world} />
      <HudLayer world={world} />
    </div>
  );
}
