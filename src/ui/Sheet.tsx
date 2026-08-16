import type { ReactNode } from "react";

/**
 * The shared chrome for every HTML screen.
 *
 * Data screens are allowed to be conventional and legible (ASSET_SPEC §7), but
 * they are framed as an in-world ledger book: wooden borders, hard corners, no
 * border-radius, no shadow, no glassmorphism. Usability without breaking fiction.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" onPointerDown={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}
