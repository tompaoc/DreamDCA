import { useRef, useState } from "react";
import { ImportError } from "../core/backup";
import { todayKey } from "../core/date";
import { useStore } from "../store/useStore";
import { Sheet } from "./Sheet";

/**
 * Export / import.
 *
 * HANDOFF.md: "the single most important item". The ledger lives in one
 * browser's IndexedDB; clearing site data destroys a two-year record. Until
 * there is cloud sync, a file the user holds is the only real backup.
 */
export function BackupSheet({ onClose }: { onClose: () => void }) {
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const entryCount = useStore((s) => s.entries.length);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dreamdca-btc-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage(`ส่งออก ${entryCount} รายการแล้ว — เก็บไฟล์นี้ไว้นอกเครื่อง`);
    setError(null);
  };

  const onFile = async (file: File) => {
    setMessage(null);
    setError(null);
    try {
      const n = await importJson(await file.text(), mode);
      setMessage(
        mode === "replace"
          ? `แทนที่ข้อมูลทั้งหมดด้วย ${n} รายการแล้ว`
          : n === 0
            ? "ไม่มีรายการใหม่ — ไฟล์นี้นำเข้าไปแล้ว"
            : `เพิ่ม ${n} รายการใหม่`,
      );
    } catch (e) {
      setError(e instanceof ImportError ? e.message : "นำเข้าไม่สำเร็จ");
    }
  };

  return (
    <Sheet title="สำรองข้อมูล" onClose={onClose}>
      <p className="muted">
        ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ถ้าล้างข้อมูลเว็บไซต์ ประวัติจะหายถาวร
        — ส่งออกเก็บไว้เป็นระยะ
      </p>

      <button type="button" className="btn btn-primary btn-block" onClick={download}>
        ส่งออกเป็นไฟล์ JSON ({entryCount} รายการ)
      </button>

      <hr className="rule" />

      <div className="radio-row">
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "merge"}
            onChange={() => setMode("merge")}
          />
          รวมกับข้อมูลเดิม
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "replace"}
            onChange={() => setMode("replace")}
          />
          แทนที่ทั้งหมด
        </label>
      </div>

      <button
        type="button"
        className="btn btn-block"
        onClick={() => fileRef.current?.click()}
      >
        นำเข้าจากไฟล์…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />

      {message ? <p className="ok">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </Sheet>
  );
}
