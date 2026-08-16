import { useMemo, useState } from "react";
import { isValidDay, todayKey } from "../core/date";
import { MoneyError, centsToFiat, fiatToCents, satsToBtc, satsFor } from "../core/money";
import type { Entry } from "../core/types";
import { useStore } from "../store/useStore";
import { Sheet } from "./Sheet";

/**
 * Purchase entry: date, fiat amount, price paid -> computed satoshis (AUDIT §7.7).
 *
 * No price API anywhere (§3 REJECTED). The user types the price they actually
 * paid, which is both more accurate than a daily close and removes every API
 * key, rate limit and outage from the MVP.
 */
export function RecordSheet({
  onClose,
  initialDate,
  editing,
}: {
  onClose: () => void;
  initialDate?: string;
  editing?: Entry;
}) {
  const addEntry = useStore((s) => s.addEntry);
  const updateEntry = useStore((s) => s.updateEntry);
  const deleteEntry = useStore((s) => s.deleteEntry);

  const [date, setDate] = useState(editing?.date ?? initialDate ?? todayKey());
  const [fiat, setFiat] = useState(editing ? centsToFiat(editing.fiatCents) : "");
  const [price, setPrice] = useState(
    editing ? centsToFiat(Math.round((editing.fiatCents * 1e8) / editing.sats)) : "",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    if (!fiat.trim() || !price.trim()) return null;
    try {
      const cents = fiatToCents(fiat);
      const priceCents = fiatToCents(price);
      if (cents <= 0 || priceCents <= 0) return null;
      return satsFor(cents, priceCents);
    } catch {
      return null;
    }
  }, [fiat, price]);

  const submit = async () => {
    setError(null);
    if (!isValidDay(date)) return setError("วันที่ไม่ถูกต้อง");
    let sats: number;
    let fiatCents: number;
    try {
      fiatCents = fiatToCents(fiat);
      const priceCents = fiatToCents(price);
      if (fiatCents <= 0) return setError("จำนวนเงินต้องมากกว่า 0");
      if (priceCents <= 0) return setError("ราคาต้องมากกว่า 0");
      sats = satsFor(fiatCents, priceCents);
      if (sats <= 0) return setError("จำนวนที่ได้เป็น 0 satoshi — ตรวจราคาอีกครั้ง");
    } catch (e) {
      return setError(e instanceof MoneyError ? e.message : "ตัวเลขไม่ถูกต้อง");
    }

    setBusy(true);
    try {
      const payload = { date, sats, fiatCents, ...(note.trim() ? { note: note.trim() } : {}) };
      if (editing) await updateEntry(editing.id, payload);
      else await addEntry(payload);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteEntry(editing.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={editing ? "แก้ไขรายการ" : "บันทึกการซื้อ"}
      onClose={onClose}
      footer={
        <>
          {editing ? (
            <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
              ลบ
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {editing ? "บันทึกการแก้ไข" : "บันทึก"}
          </button>
        </>
      }
    >
      <label className="field">
        <span>วันที่</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max="2027-12-31" />
      </label>

      <label className="field">
        <span>จำนวนเงินที่จ่าย (USD)</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="9.34"
          value={fiat}
          onChange={(e) => setFiat(e.target.value)}
        />
      </label>

      <label className="field">
        <span>ราคา BTC ที่ซื้อ (USD)</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="66700"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>

      <div className="readout">
        <span>ได้รับ</span>
        <b>{preview === null ? "—" : `${satsToBtc(preview, true)} BTC`}</b>
        <small>{preview === null ? "" : `${preview.toLocaleString("en-US")} satoshi`}</small>
      </div>

      <label className="field">
        <span>บันทึกช่วยจำ (ไม่บังคับ)</span>
        <input
          type="text"
          value={note}
          maxLength={120}
          placeholder="เช่น DCA รอบเช้า"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error ? <p className="error">{error}</p> : null}
    </Sheet>
  );
}
