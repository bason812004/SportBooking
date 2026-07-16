import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";

export type PopoverAnchor = { x: number; y: number };

export function SlotActionPopover({
  anchor,
  title,
  reason,
  confirmLabel,
  onConfirm,
  onClose,
  pending
}: {
  anchor: PopoverAnchor | null;
  title: string;
  reason?: string | null;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchor, onClose]);

  if (!anchor) return null;

  const left = Math.min(Math.max(anchor.x, 140), window.innerWidth - 140);
  const top = anchor.y;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 -translate-x-1/2 rounded-xl border border-line bg-white p-4 shadow-2xl shadow-slate-900/10"
      style={{ left, top }}
    >
      <span
        className="absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-line bg-white"
        style={{ left: Math.max(8, Math.min(anchor.x - left + 128 - 6, 244)) }}
      />
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{reason ? `Lý do: ${reason}` : "Không có ghi chú lý do."}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        <Button variant="danger" disabled={pending} onClick={onConfirm}>{pending ? "Đang xử lý..." : confirmLabel}</Button>
      </div>
    </div>
  );
}
