import { Suspense, lazy, useEffect, useState } from "react";
import type { Entry } from "./core/types";
import { type UpdateHandle, initPwa } from "./pwa";
import { useStore } from "./store/useStore";
import { BackupSheet } from "./ui/BackupSheet";
import { CalendarSheet } from "./ui/CalendarSheet";
import { RecordSheet } from "./ui/RecordSheet";
import { UnlockSummary } from "./ui/UnlockSummary";
import { UpdateBanner } from "./ui/UpdateBanner";

/**
 * Phaser is mounted only on the World screen (AUDIT §2), so it is also *loaded*
 * only there. Keeping the ~1.5MB engine out of the entry chunk is what lets the
 * ledger, calendar and purchase form open fast on mobile data.
 */
const PhaserGame = lazy(() => import("./game/PhaserGame"));

type Screen =
  | { kind: "world" }
  | { kind: "record"; date?: string; editing?: Entry }
  | { kind: "calendar" }
  | { kind: "backup" };

export default function App() {
  const ready = useStore((s) => s.ready);
  const load = useStore((s) => s.load);
  const stageLabel = useStore((s) => s.world.stageLabel);
  const [screen, setScreen] = useState<Screen>({ kind: "world" });
  const [update, setUpdate] = useState<UpdateHandle | null>(null);

  useEffect(() => {
    void load();
    // Registered after the initial ledger load is kicked off, not before: the
    // ledger read must never race a service-worker install on first launch.
    initPwa(setUpdate);
  }, [load]);

  const close = () => setScreen({ kind: "world" });

  return (
    <div className="app">
      <Suspense fallback={<div className="boot" />}>
        <PhaserGame />
      </Suspense>

      {update ? <UpdateBanner handle={update} onDismiss={() => setUpdate(null)} /> : null}

      {/* Thai lives in the HTML layer; the canvas HUD is ASCII bitmap only (L10). */}
      <div className="stage-strip">{ready ? stageLabel : "กำลังเปิดโลก…"}</div>

      <nav className="action-bar">
        <button type="button" className="ab" onClick={() => setScreen({ kind: "backup" })}>
          สำรองข้อมูล
        </button>
        <button
          type="button"
          className="ab ab-main"
          onClick={() => setScreen({ kind: "record" })}
          disabled={!ready}
        >
          บันทึกการซื้อ
        </button>
        <button type="button" className="ab" onClick={() => setScreen({ kind: "calendar" })}>
          ปฏิทิน
        </button>
      </nav>

      {screen.kind === "record" ? (
        <RecordSheet onClose={close} initialDate={screen.date} editing={screen.editing} />
      ) : null}

      {screen.kind === "calendar" ? (
        <CalendarSheet
          onClose={close}
          onPickDay={(date) => setScreen({ kind: "record", date })}
          onEditEntry={(editing) => setScreen({ kind: "record", editing })}
        />
      ) : null}

      {screen.kind === "backup" ? <BackupSheet onClose={close} /> : null}

      <UnlockSummary />
    </div>
  );
}
