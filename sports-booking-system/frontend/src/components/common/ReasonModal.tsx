import { useState, type ReactNode } from "react";
import { Button } from "../ui/Button";

/** Mount it with a key per target so the text starts empty for each one. */
export function ReasonModal({
  open,
  title,
  required = false,
  description,
  label = "Lý do / ghi chú",
  placeholder = "Nhập nội dung để lưu vào lịch sử kiểm duyệt",
  confirmLabel = "Xác nhận",
  confirmVariant = "danger",
  pending = false,
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  required?: boolean;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  /** While the action is being sent: blocks a second submit. */
  pending?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6">
        <h2 className="text-xl font-bold">{title}</h2>
        {description && <div className="mt-2 text-sm text-slate-600">{description}</div>}
        <label className="mt-4 grid gap-2 text-sm">
          {label}
          <textarea className="min-h-28 rounded-md border p-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>Hủy</Button>
          <Button
            variant={confirmVariant}
            disabled={pending || (required && reason.trim().length < 3)}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
