import { useState } from "react";
import { Button } from "../../components/ui/Button";

export function AdminReasonModal({ open, title, required = false, onClose, onConfirm }: {
  open: boolean; title: string; required?: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6"><h2 className="text-xl font-bold">{title}</h2><label className="mt-4 grid gap-2 text-sm">Lý do / ghi chú<textarea className="min-h-28 rounded-md border p-3" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Nhập nội dung để lưu vào lịch sử kiểm duyệt"/></label><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button variant="danger" disabled={required&&reason.trim().length<3} onClick={()=>onConfirm(reason.trim())}>Xác nhận</Button></div></div></div>;
}
