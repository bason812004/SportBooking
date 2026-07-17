import { useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Clock3, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { SettlementStatusBadge, WithdrawalStatusBadge } from "../admin/StatusBadges";
import type { PartnerWallet } from "../../types/api";

const money = (value: number | string | null | undefined) => `${Number(value ?? 0).toLocaleString("vi-VN")} đ`;

export function PartnerWalletPage() {
  const [tab, setTab] = useState<"overview" | "settlements" | "withdrawals">("overview");
  const [settlementPage, setSettlementPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const wallet = useQuery({ queryKey: ["partner-wallet"], queryFn: () => partnerApi.myWallet() });
  const settlements = useQuery({
    queryKey: ["partner-settlements", settlementPage],
    queryFn: () => partnerApi.mySettlements({ page: settlementPage, limit: 10 }),
    placeholderData: keepPreviousData
  });
  const withdrawals = useQuery({
    queryKey: ["partner-withdrawals", withdrawalPage],
    queryFn: () => partnerApi.myWithdrawals({ page: withdrawalPage, limit: 10 }),
    placeholderData: keepPreviousData
  });

  if (wallet.isLoading) return <LoadingState />;
  if (wallet.isError) return <ErrorState message={wallet.error.message} />;

  const data = wallet.data!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ví & Quyết toán</h1>
          <p className="mt-2 text-slate-600">Theo dõi doanh thu đã quyết toán và tạo yêu cầu rút tiền về tài khoản ngân hàng.</p>
        </div>
        <Button disabled={data.availableBalance <= 0} onClick={() => setWithdrawOpen(true)}>
          <Banknote className="h-4 w-4" />
          Rút tiền
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<WalletCards className="h-5 w-5" />} label="Số dư khả dụng" value={money(data.availableBalance)} tone="text-emerald-700" />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Chờ quyết toán" value={money(data.pendingBalance)} tone="text-amber-600" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Tổng doanh thu" value={money(data.totalEarned)} />
        <StatCard icon={<Banknote className="h-5 w-5" />} label="Đã rút" value={money(data.totalWithdrawn)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Tổng quan</TabButton>
        <TabButton active={tab === "settlements"} onClick={() => setTab("settlements")}>Lịch sử quyết toán</TabButton>
        <TabButton active={tab === "withdrawals"} onClick={() => setTab("withdrawals")}>Lịch sử rút tiền</TabButton>
      </div>

      {tab === "overview" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-bold">Quy tắc quyết toán</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Khi khách thanh toán online thành công, tiền thực nhận được cộng vào mục <b>Chờ quyết toán</b>.</li>
              <li>Khi đơn đặt sân hoàn thành, khoản tiền chuyển sang <b>Số dư khả dụng</b> và có thể rút.</li>
              <li>Nếu đơn bị hủy trước khi hoàn thành, khoản chờ quyết toán tương ứng sẽ bị thu hồi.</li>
              <li>Đơn thanh toán tiền mặt tại sân không đi qua ví (bạn đã nhận tiền trực tiếp).</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-bold">Quy tắc tính doanh thu</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Doanh thu gốc = tổng tiền đơn (đã trừ voucher bạn tài trợ).</li>
              <li>Thực nhận = doanh thu gốc − hoa hồng nền tảng theo tỷ lệ áp dụng cho bạn.</li>
              <li>Yêu cầu rút tiền sẽ tạm giữ số tiền tương ứng cho đến khi admin xử lý; nếu bị từ chối, tiền được hoàn lại ví.</li>
            </ul>
          </div>
        </section>
      )}

      {tab === "settlements" && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {settlements.isLoading ? (
            <LoadingState />
          ) : settlements.isError ? (
            <ErrorState message={settlements.error.message} />
          ) : (
            <>
              <div className="overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <THead>
                    <tr>
                      <Th>Mã booking</Th>
                      <Th>Ngày tạo</Th>
                      <Th className="text-right">Doanh thu gốc</Th>
                      <Th className="text-right">Hoa hồng</Th>
                      <Th className="text-right">Thực nhận</Th>
                      <Th>Trạng thái</Th>
                      <Th>Quyết toán lúc</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {(settlements.data?.items ?? []).map((item) => (
                      <Tr key={item.id}>
                        <Td className="font-medium">{item.booking?.bookingCode ?? item.bookingId}</Td>
                        <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                        <Td className="text-right">{money(item.grossAmount)}</Td>
                        <Td className="text-right text-red-600">
                          {money(item.commissionAmount)} ({item.commissionRate}%)
                        </Td>
                        <Td className="text-right font-semibold text-emerald-700">{money(item.netAmount)}</Td>
                        <Td><SettlementStatusBadge status={item.status} /></Td>
                        <Td>{item.settledAt ? new Date(item.settledAt).toLocaleString("vi-VN") : "—"}</Td>
                      </Tr>
                    ))}
                    {(settlements.data?.items ?? []).length === 0 && (
                      <tr>
                        <Td className="p-8 text-center text-slate-500" colSpan={7}>Chưa có quyết toán nào.</Td>
                      </tr>
                    )}
                  </TBody>
                </table>
              </div>
              <div className="border-t border-line p-4">
                <Pager page={settlementPage} total={settlements.data?.meta.totalPages ?? 1} setPage={setSettlementPage} />
              </div>
            </>
          )}
        </section>
      )}

      {tab === "withdrawals" && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {withdrawals.isLoading ? (
            <LoadingState />
          ) : withdrawals.isError ? (
            <ErrorState message={withdrawals.error.message} />
          ) : (
            <>
              <div className="overflow-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <THead>
                    <tr>
                      <Th>Ngày tạo</Th>
                      <Th className="text-right">Số tiền</Th>
                      <Th>Ngân hàng</Th>
                      <Th>Số tài khoản</Th>
                      <Th>Trạng thái</Th>
                      <Th>Ghi chú</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {(withdrawals.data?.items ?? []).map((item) => (
                      <Tr key={item.id}>
                        <Td>{new Date(item.createdAt).toLocaleString("vi-VN")}</Td>
                        <Td className="text-right font-semibold">{money(item.amount)}</Td>
                        <Td>{item.bankName ?? "—"}</Td>
                        <Td>{item.bankAccountNumber ?? "—"}</Td>
                        <Td><WithdrawalStatusBadge status={item.status} /></Td>
                        <Td className="max-w-[240px] truncate" title={item.note ?? undefined}>{item.note ?? "—"}</Td>
                      </Tr>
                    ))}
                    {(withdrawals.data?.items ?? []).length === 0 && (
                      <tr>
                        <Td className="p-8 text-center text-slate-500" colSpan={6}>Chưa có yêu cầu rút tiền nào.</Td>
                      </tr>
                    )}
                  </TBody>
                </table>
              </div>
              <div className="border-t border-line p-4">
                <Pager page={withdrawalPage} total={withdrawals.data?.meta.totalPages ?? 1} setPage={setWithdrawalPage} />
              </div>
            </>
          )}
        </section>
      )}

      <WithdrawModal open={withdrawOpen} wallet={data} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}

function WithdrawModal({ open, wallet, onClose }: { open: boolean; wallet: PartnerWallet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState(wallet.bankName ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(wallet.bankAccountNumber ?? "");
  const [bankAccountName, setBankAccountName] = useState(wallet.bankAccountHolder ?? "");

  const create = useMutation({
    mutationFn: () =>
      partnerApi.createWithdrawal({
        amount: Number(amount),
        bankName: bankName.trim() || undefined,
        bankAccountNumber: bankAccountNumber.trim() || undefined,
        bankAccountName: bankAccountName.trim() || undefined
      }),
    onSuccess: async () => {
      toast.success("Đã gửi yêu cầu rút tiền");
      setAmount("");
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["partner-wallet"] });
      await queryClient.invalidateQueries({ queryKey: ["partner-withdrawals"] });
    },
    onError: (error) => toast.error(error.message)
  });

  if (!open) return null;
  const parsedAmount = Number(amount);
  const invalid =
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    parsedAmount > wallet.availableBalance ||
    !bankName.trim() ||
    !bankAccountNumber.trim() ||
    !bankAccountName.trim();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6">
        <h2 className="text-xl font-bold">Tạo yêu cầu rút tiền</h2>
        <p className="mt-1 text-sm text-slate-600">
          Số dư khả dụng: <b className="text-emerald-700">{money(wallet.availableBalance)}</b>. Tiền sẽ được tạm giữ cho đến khi admin xử lý.
        </p>
        <div className="mt-4 grid gap-3">
          <Input label="Số tiền muốn rút (đ)" type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Input label="Ngân hàng" value={bankName} onChange={(event) => setBankName(event.target.value)} />
          <Input label="Số tài khoản" value={bankAccountNumber} onChange={(event) => setBankAccountNumber(event.target.value)} />
          <Input label="Chủ tài khoản" value={bankAccountName} onChange={(event) => setBankAccountName(event.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button disabled={invalid || create.isPending} onClick={() => create.mutate()}>Gửi yêu cầu</Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone = "" }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${active ? "border-action bg-action text-white" : "border-line bg-white text-ink"}`}
      onClick={onClick}
    >
      {children}
    </button>
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
