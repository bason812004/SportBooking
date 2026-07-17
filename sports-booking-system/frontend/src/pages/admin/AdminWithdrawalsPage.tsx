import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { adminApi } from "../../features/admin/api/adminApi";
import { AdminReasonModal } from "./AdminReasonModal";
import { WithdrawalStatusBadge } from "./StatusBadges";
import type { WithdrawalRequest } from "../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Từ chối" },
  { value: "PAID", label: "Đã chuyển khoản" }
];

export function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<WithdrawalRequest | null>(null);

  const summary = useQuery({ queryKey: ["admin-withdrawals-summary"], queryFn: () => adminApi.withdrawalsSummary() });
  const withdrawals = useQuery({
    queryKey: ["admin-withdrawals", status, page],
    queryFn: () => adminApi.withdrawals({ status: status || undefined, page, limit: 10 }),
    placeholderData: keepPreviousData
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-withdrawals-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
  };

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveWithdrawal(id),
    onSuccess: async () => { toast.success("Đã duyệt yêu cầu"); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.rejectWithdrawal(id, note || undefined),
    onSuccess: async () => { toast.success("Đã từ chối và hoàn tiền vào ví"); setRejecting(null); await refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const pay = useMutation({
    mutationFn: (id: string) => adminApi.payWithdrawal(id),
    onSuccess: async () => { toast.success("Đã xác nhận chuyển khoản"); await refresh(); },
    onError: (error) => toast.error(error.message)
  });

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) return <ErrorState message={summary.error.message} />;

  const data = summary.data!;
  const pending = data.byStatus.PENDING;
  const paid = data.byStatus.PAID;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Yêu cầu rút tiền</h1>
          <p className="text-sm text-slate-600">Duyệt và xác nhận chuyển khoản cho yêu cầu rút tiền của partner.</p>
        </div>
        <Select label="Trạng thái" value={status} options={statusOptions} onChange={(event) => { setPage(1); setStatus(event.target.value); }} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Summary label="Tổng yêu cầu" value={`${data.total.count} yêu cầu · ${money(data.total.amount)}`} />
        <Summary label="Chờ duyệt" value={`${pending?.count ?? 0} yêu cầu · ${money(pending?.amount ?? 0)}`} />
        <Summary label="Đã chuyển khoản" value={`${paid?.count ?? 0} yêu cầu · ${money(paid?.amount ?? 0)}`} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        {withdrawals.isLoading ? (
          <LoadingState />
        ) : withdrawals.isError ? (
          <ErrorState message={withdrawals.error.message} />
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <THead>
                  <tr>
                    <Th>Ngày tạo</Th>
                    <Th>Partner</Th>
                    <Th className="text-right">Số tiền</Th>
                    <Th>Ngân hàng</Th>
                    <Th>Số tài khoản</Th>
                    <Th>Chủ tài khoản</Th>
                    <Th>Trạng thái</Th>
                    <Th>Người xử lý</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </THead>
                <TBody>
                  {(withdrawals.data?.items ?? []).map((item) => (
                    <Tr key={item.id}>
                      <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                      <Td className="font-medium">{item.partner?.businessName ?? item.partnerId}</Td>
                      <Td className="text-right font-semibold">{money(item.amount)}</Td>
                      <Td>{item.bankName ?? "—"}</Td>
                      <Td>{item.bankAccountNumber ?? "—"}</Td>
                      <Td>{item.bankAccountName ?? "—"}</Td>
                      <Td><WithdrawalStatusBadge status={item.status} /></Td>
                      <Td>{item.processor?.fullName ?? "—"}</Td>
                      <Td className="text-right">
                        {item.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button disabled={approve.isPending} onClick={() => approve.mutate(item.id)}>Duyệt</Button>
                            <Button variant="danger" onClick={() => setRejecting(item)}>Từ chối</Button>
                          </div>
                        ) : item.status === "APPROVED" ? (
                          <div className="flex justify-end gap-2">
                            <Button disabled={pay.isPending} onClick={() => pay.mutate(item.id)}>Đã chuyển khoản</Button>
                            <Button variant="danger" onClick={() => setRejecting(item)}>Từ chối</Button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {(withdrawals.data?.items ?? []).length === 0 && (
                    <tr>
                      <Td className="p-8 text-center text-slate-500" colSpan={9}>Không có yêu cầu rút tiền nào.</Td>
                    </tr>
                  )}
                </TBody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              <Pager page={page} total={withdrawals.data?.meta.totalPages ?? 1} setPage={setPage} />
            </div>
          </>
        )}
      </section>

      <AdminReasonModal
        open={rejecting !== null}
        title={`Từ chối yêu cầu rút ${money(rejecting?.amount)}?`}
        required
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting.id, note: reason })}
      />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-4 text-white">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (value: number) => void }) {
  return (
    <div className="flex justify-end gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
      <span className="py-2">{page}/{Math.max(total, 1)}</span>
      <Button variant="secondary" disabled={page >= total} onClick={() => setPage(page + 1)}>Sau</Button>
    </div>
  );
}
