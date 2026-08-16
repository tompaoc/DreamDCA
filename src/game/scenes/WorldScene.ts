import Phaser from "phaser";
import { MILESTONES } from "../../core/progression";
import type { Derived, WorldState } from "../../core/types";
import colliderData from "../../data/colliders.json";
import propData from "../../data/props.json";
import { useStore } from "../../store/useStore";
import { Hud, type HudModel } from "../hud";
import { bakeTerrain, buildPlaceholderTextures } from "../placeholder";
import { DESIGN_H, DESIGN_W } from "../scale";

/** A prop instance, exactly as exported from Tiled's object layer (ASSET_SPEC §8). */
export type PropDef = {
  id: string;
  sprite: string;
  /** Top-left, in internal pixels. Props are free-positioned, never snapped to tiles (L7). */
  x: number;
  y: number;
  /** Ground-contact row, relative to sprite top. Drives depth sort. */
  anchorY: number;
  /** Collision rect relative to sprite top-left. NEVER derived from sprite bounds (L8). */
  footprint: { x: number; y: number; w: number; h: number } | null;
  /** Milestone that grants this prop, or null for always-present. Documentation only —
   *  runtime visibility comes from worldState.visibleProps. */
  unlock: string | null;
  interact: string | null;
  worldStage: number;
};

const PROPS = (propData as PropDef[]).filter((p) => p.id);
const COLLIDERS = colliderData as Array<{ id: string; x: number; y: number; w: number; h: number }>;

const WALK_SPEED = 74;
/** Terrain is baked this tall so even the tallest phone extends into real world. */
const TERRAIN_H = 1400;

type Sorted = { obj: Phaser.GameObjects.Sprite; sortY: number };

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private hud!: Hud;

  private keys?: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  /** Sprites whose depth follows a ground-contact row, resolved every frame. */
  private sorted: Sorted[] = [];
  private propSprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** Static bodies keyed by prop id, so a hidden prop stops colliding too. */
  private propBodies = new Map<string, Phaser.GameObjects.Zone>();
  private entities = new Map<string, Phaser.GameObjects.Sprite[]>();

  private unsubscribe?: () => void;

  private stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };

  constructor() {
    super("world");
  }

  create(): void {
    buildPlaceholderTextures(this);

    const terrainKey = bakeTerrain(this, DESIGN_W, TERRAIN_H);
    this.add.image(0, 0, terrainKey).setOrigin(0, 0).setDepth(-10_000);

    this.solids = this.physics.add.staticGroup();
    this.buildProps();
    this.buildTerrainColliders();
    this.buildAnimations();
    this.buildPlayer();
    this.hud = new Hud(this);

    this.physics.add.collider(this.player, this.solids);
    this.onResize(this.scale.height);
    this.player.setCollideWorldBounds(true);

    this.bindInput();
    this.bindStore();
  }

  /* ── store bridge ───────────────────────────────────────────────────────── */

  /**
   * Phaser never owns financial data (AUDIT §2). It subscribes to a snapshot of
   * worldState and *reconciles* — adds, removes and swaps sprites. The scene is
   * never reloaded, so a milestone crossing is a visible change, not a reboot.
   */
  private bindStore(): void {
    const apply = (s: { world: WorldState; derived: Derived }) => {
      this.applyWorldState(s.world);
      this.hud.update(hudModel(s.derived, s.world));
    };
    apply(useStore.getState());
    this.unsubscribe = useStore.subscribe(apply);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  private applyWorldState(world: WorldState): void {
    for (const def of PROPS) {
      const sprite = this.propSprites.get(def.id);
      if (!sprite) continue;

      const visible = def.unlock === null || world.visibleProps.has(def.id);
      sprite.setVisible(visible);

      // Collision follows visibility: an invisible fence must not block the path.
      const body = this.propBodies.get(def.id);
      if (body) {
        const arcade = body.body as Phaser.Physics.Arcade.StaticBody | null;
        if (arcade) arcade.enable = visible;
      }

      const variant = def.id === "home" ? world.homeSprite : world.propVariants[def.id];
      if (variant && sprite.texture.key !== variant && this.textures.exists(variant)) {
        sprite.setTexture(variant);
      }
    }

    for (const [kind, sprites] of this.entities) {
      const active = world.activeEntities.has(kind);
      for (const s of sprites) s.setVisible(active);
    }
  }

  /* ── construction ───────────────────────────────────────────────────────── */

  private buildProps(): void {
    for (const def of PROPS) {
      const sprite = this.add.sprite(def.x, def.y, def.sprite).setOrigin(0, 0).setVisible(false);
      this.propSprites.set(def.id, sprite);
      // Depth is the ground-contact row, not the sprite's y. A tree canopy sorts
      // at the base of its trunk, which is why anchorY may exceed sprite height.
      this.sorted.push({ obj: sprite, sortY: def.y + def.anchorY });

      if (def.footprint) {
        const f = def.footprint;
        this.propBodies.set(def.id, this.addSolid(def.x + f.x, def.y + f.y, f.w, f.h));
      }
    }
  }

  private buildTerrainColliders(): void {
    for (const c of COLLIDERS) this.addSolid(c.x, c.y, c.w, c.h);
  }

  private addSolid(x: number, y: number, w: number, h: number): Phaser.GameObjects.Zone {
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
    return zone;
  }

  private buildAnimations(): void {
    for (const dir of ["south", "north", "east"] as const) {
      this.anims.create({
        key: `player_walk_${dir}`,
        frames: [0, 1, 2, 3].map((f) => ({ key: `char_player_walk_${dir}_${f}` })),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: `player_idle_${dir}`,
        frames: [{ key: `char_player_idle_${dir}_0` }],
        frameRate: 1,
      });
    }
    this.anims.create({
      key: "chicken_idle",
      frames: [0, 1].map((f) => ({ key: `anim_chicken_idle_south_${f}` })),
      frameRate: 3,
      repeat: -1,
    });
    this.anims.create({
      key: "dog_idle",
      frames: [0, 1].map((f) => ({ key: `anim_dog_idle_south_${f}` })),
      frameRate: 4,
      repeat: -1,
      yoyo: true,
    });

    this.spawnEntity("chicken", "anim_chicken_idle_south_0", "chicken_idle", 15, [
      [96, 388],
      [128, 404],
    ]);
    this.spawnEntity("dog", "anim_dog_idle_south_0", "dog_idle", 19, [[240, 340]]);
  }

  private spawnEntity(
    kind: string,
    texture: string,
    anim: string,
    anchorY: number,
    positions: Array<[number, number]>,
  ): void {
    const made = positions.map(([x, y], i) => {
      const s = this.add
        .sprite(x, y, texture)
        .setOrigin(0.5, anchorY / this.textures.get(texture).getSourceImage().height)
        .setVisible(false);
      s.play({ key: anim, startFrame: i % 2 });
      this.sorted.push({ obj: s, sortY: y });
      return s;
    });
    this.entities.set(kind, made);
  }

  private buildPlayer(): void {
    this.player = this.physics.add.sprite(180, 560, "char_player_idle_south_0");
    // Origin sits on the ground-contact row (47 of 48), so `player.y` IS the row
    // that both depth sorting and collision positioning use.
    this.player.setOrigin(0.5, 47 / 48);
    // The collider is a small box at the feet — decoupled from the art (L8).
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 10);
    body.setOffset(6, 37);
    this.player.play("player_idle_south");
    this.sorted.push({ obj: this.player, sortY: this.player.y });
  }

  /* ── input ──────────────────────────────────────────────────────────────── */

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keys = {
        up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.stick = { active: true, ox: p.worldX, oy: p.worldY, dx: 0, dy: 0 };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.stick.active) return;
      this.stick.dx = p.worldX - this.stick.ox;
      this.stick.dy = p.worldY - this.stick.oy;
    });
    const release = () => {
      this.stick.active = false;
      this.stick.dx = 0;
      this.stick.dy = 0;
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  private readInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.cursors && this.keys) {
      if (this.cursors.left.isDown || this.keys.left.isDown) x -= 1;
      if (this.cursors.right.isDown || this.keys.right.isDown) x += 1;
      if (this.cursors.up.isDown || this.keys.up.isDown) y -= 1;
      if (this.cursors.down.isDown || this.keys.down.isDown) y += 1;
    }
    if (this.stick.active) {
      const len = Math.hypot(this.stick.dx, this.stick.dy);
      if (len > 6) {
        x += this.stick.dx / len;
        y += this.stick.dy / len;
      }
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /* ── frame ──────────────────────────────────────────────────────────────── */

  update(): void {
    const dir = this.readInput();
    this.player.setVelocity(dir.x * WALK_SPEED, dir.y * WALK_SPEED);

    if (dir.x === 0 && dir.y === 0) {
      const key = this.player.anims.currentAnim?.key ?? "player_walk_south";
      this.player.play(key.replace("walk", "idle"), true);
    } else if (Math.abs(dir.x) > Math.abs(dir.y)) {
      // west is a horizontal mirror of east — never authored separately (L12).
      this.player.setFlipX(dir.x < 0);
      this.player.play("player_walk_east", true);
    } else {
      this.player.setFlipX(false);
      this.player.play(dir.y < 0 ? "player_walk_north" : "player_walk_south", true);
    }

    // One depth rule for cottages, fences, trees, animals and the player alike.
    this.player.setDepth(Math.round(this.player.y));
    for (const s of this.sorted) {
      if (s.obj === this.player) continue;
      s.obj.setDepth(Math.round(s.sortY));
    }
  }

  /** Called when the canvas grows on a tall phone: extend the world, don't letterbox. */
  onResize(internalH: number): void {
    this.physics.world.setBounds(0, 0, DESIGN_W, Math.max(DESIGN_H, internalH));
  }
}

/**
 * What the gauge is filling toward. Picking the *nearest unmet* milestone keeps
 * the HUD pointed at something reachable instead of a two-year BTC target.
 */
function hudModel(d: Derived, w: WorldState): HudModel {
  let best: { label: string; progress: number } | null = null;
  for (const m of MILESTONES) {
    const r = m.requires;
    const candidates: Array<[number, number, string]> = [];
    if (r.streak !== undefined) candidates.push([d.streak, r.streak, `${r.streak} DAY STREAK`]);
    if (r.daysRecorded !== undefined) {
      candidates.push([d.daysRecorded, r.daysRecorded, `${r.daysRecorded} DAYS RECORDED`]);
    }
    if (r.sats !== undefined) {
      candidates.push([d.totalSats, r.sats, `${(r.sats / 100_000_000).toFixed(2)} BTC`]);
    }
    for (const [have, need, label] of candidates) {
      if (have >= need) continue;
      const progress = need > 0 ? have / need : 1;
      if (!best || progress > best.progress) best = { label: `NEXT  ${label}`, progress };
    }
  }
  return {
    streak: d.streak,
    daysRecorded: d.daysRecorded,
    totalSats: d.totalSats,
    stage: w.stage,
    nextProgress: best?.progress ?? 1,
    nextLabel: best?.label ?? "ALL MILESTONES REACHED",
  };
}
