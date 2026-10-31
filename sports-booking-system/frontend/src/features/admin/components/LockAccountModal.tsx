import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { adminApi } from "../api/adminApi";

// What a lock does for each role, shown before the admin confirms it.
const lockConsequence: Record<string, string> = {
  USER: "Khách hàng bị đăng xuất và không đặt sân được nữa. Các đơn đã đặt vẫn giữ nguyên.",
  PARTNER:
    "Đối tác bị đăng xuất và không vào được trang quản lý. Toàn bộ sân của đối tác bị ẩn khỏi trang công khai: khách không tìm thấy và không đặt mới được. Các đơn đã đặt vẫn giữ nguyên.",
  RECIPIENT: "Nhân viên bị đăng xuất và không thao tác được ở quầy nữa.",
  ADMIN: "Quản trị viên này bị đăng xuất và mất quyền quản trị."
};

type LockTarget = { id: string; fullName: string; role: string };

/** Confirms an account lock with its consequence for that role and an optional reason kept in the audit log. */
export function LockAccountModal({ account, onClose, onLocked }: { account: LockTarget | null; onClose: () => void; onLocked: () => void }) {
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };

  const lock = useMutation({
    mutationFn: (target: LockTarget) => adminApi.lockUser(target.id, reason.trim() || undefined),
    onSuccess: (_result, target) => {
      toast.success(`Đã khóa tài khoản ${target.fullName}`);
      close();
      onLocked();
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <Modal isOpen={account != null} onClose={close} title={`Khóa tài khoản ${account?.fullName ?? ""}?`}>
      {account && (
        <div className="space-y-4">
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {lockConsequence[account.role] ?? "Tài khoản bị đăng xuất và không dùng được nữa."}
          </p>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Lý do (không bắt buộc, lưu vào nhật ký kiểm toán)
            <textarea
              className="min-h-24 rounded-md border border-line p-3 text-sm outline-none focus:border-action"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Hủy</Button>
            <Button variant="danger" disabled={lock.isPending} onClick={() => lock.mutate(account)}>
              <Lock className="h-4 w-4" /> Khóa tài khoản
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
