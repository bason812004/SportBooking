import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../../components/common/States";
import { THead, TBody, Tr, Th, Td } from "../../../components/common/Table";
import { adminApi } from "../api/adminApi";
import type { PartnerWallet } from "../../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

/**
 * Partners owing commission on money they collected themselves, and the action to record a transfer
 * they made to the platform account (content "HH <partnerId>").
 */
export function CommissionDebtPanel() {
  const [paying, setPaying] = useState<PartnerWallet | null>(null);
  const summary = useQuery({ queryKey: ["admin-wallets", "summary"], queryFn: () => adminApi.partnerWalletSummary() });
  const debtors = useQuery({
    queryKey: ["admin-wallets", "debtors"],
    queryFn: () => adminApi.partnerWallets({ hasDebt: "true", limit: 50 })
  });

  const items = debtors.data?.items ?? [];

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Receipt className="h-5 w-5 text-red-600" />
            Công nợ hoa hồng
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Hoa hồng trên tiền sân khách trả trực tiếp cho đối tác mà ví của họ chưa đủ để trừ. Thu nhập online mới tự trừ nợ trước.
          </p>
        </div>
        {summary.data && (
          <div className="text-right">
            <p className="text-2xl font-bold text-red-600">{money(summary.data.totalCommissionDebt)}</p>
            <p className="text-xs text-slate-500">{summary.data.debtorCount} đối tác đang nợ</p>
          </div>
        )}
      </div>
      {debtors.isLoading ? (
        <LoadingState />
      ) : debtors.isError ? (
        <ErrorState message={debtors.error.message} />
      ) : !items.length ? (
        <p className="p-5 text-sm text-slate-500">Không có đối tác nào đang nợ hoa hồng.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <THead>
              <tr>
                <Th>Đối tác</Th>
                <Th>Nội dung chuyển khoản</Th>
                <Th className="text-right">Số dư khả dụng</Th>
                <Th className="text-right">Công nợ</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {items.map((wallet) => (
                <Tr key={wallet.id}>
                  <Td>
                    <p className="font-medium">{wallet.partner?.businessName ?? wallet.partnerId}</p>
                    <p className="text-xs text-slate-500">{wallet.partner?.user?.email}</p>
                  </Td>
                  <Td className="font-mono">HH {wallet.partnerId}</Td>
                  <Td className="text-right">{money(wallet.availableBalance)}</Td>
                  <Td className="text-right font-semibold text-red-600">{money(wallet.commissionDebt)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => setPaying(wallet)}>Ghi nhận đã thu</Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </table>
        </div>
      )}
      {paying && <DebtPaymentModal wallet={paying} onClose={() => setPaying(null)} />}
    </section>
  );
}

function DebtPaymentModal({ wallet, onClose }: { wallet: PartnerWallet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(wallet.commissionDebt));
  const [note, setNote] = useState("");
  const record = useMutation({
    mutationFn: () => adminApi.recordCommissionDebtPayment(wallet.partnerId, { amount: Number(amount), note: note.trim() || undefined }),
    onSuccess: async () => {
      toast.success("Đã ghi nhận thanh toán công nợ");
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    },
    onError: (error) => toast.error(error.message)
  });
  const parsed = Number(amount);
  const invalid = !Number.isFinite(parsed) || parsed <= 0 || parsed > wallet.commissionDebt;

  return (
    <Modal isOpen onClose={onClose} title="Ghi nhận thanh toán công nợ">
      <div className="space-y-3 text-sm">
        <p>
          {wallet.partner?.businessName ?? wallet.partnerId} đang nợ <b className="text-red-600">{money(wallet.commissionDebt)}</b>. Chỉ ghi nhận sau khi đã
          thấy tiền vào tài khoản nền tảng với nội dung <b className="font-mono">HH {wallet.partnerId}</b>.
        </p>
        <Input
          label="Số tiền đã nhận (đ)"
          type="number"
          min={1}
          max={wallet.commissionDebt}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={parsed > wallet.commissionDebt ? "Không được vượt quá công nợ" : undefined}
        />
        <Input label="Ghi chú (mã giao dịch, ngân hàng...)" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button disabled={invalid || record.isPending} onClick={() => record.mutate()}>Xác nhận đã thu</Button>
        </div>
      </div>
    </Modal>
  );
}
