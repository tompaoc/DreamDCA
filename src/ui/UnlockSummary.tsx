import { useStore } from "../store/useStore";

/**
 * One batched summary, never twenty popups.
 *
 * The list comes from a diff (`unlocks − lastSeenUnlocks`), not from an event
 * fired during insertion — so backfilling six months at once produces a single
 * "your homestead grew while you were away" panel (L5 / AUDIT §6).
 */
export function UnlockSummary() {
  const pending = useStore((s) => s.pendingUnlocks);
  const acknowledge = useStore((s) => s.acknowledgeUnlocks);
  if (pending.length === 0) return null;

  return (
    <div className="sheet-backdrop">
      <section className="sheet sheet-unlock" role="dialog" aria-label="สิ่งที่ปลดล็อก">
        <header className="sheet-head">
          <h2>{pending.length === 1 ? "บ้านของคุณเติบโต" : "บ้านของคุณเติบโตตอนที่คุณไม่อยู่"}</h2>
        </header>
        <div className="sheet-body">
          <ul className="unlock-list">
            {pending.map((m) => (
              <li key={m.id}>{m.label}</li>
            ))}
          </ul>
        </div>
        <footer className="sheet-foot">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void acknowledge()}
          >
            ไปดูโลก
          </button>
        </footer>
      </section>
    </div>
  );
}
