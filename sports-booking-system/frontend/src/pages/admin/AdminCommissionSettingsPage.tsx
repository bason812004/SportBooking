import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { adminApi } from "../../features/admin/api/adminApi";
import { PageHero } from "../../components/common/PageHero";
import { ReportExportButtons } from "../../components/common/ReportExportButtons";
import { Table, THead, TBody, Tr, Th, Td } from "../../components/common/Table";
import { formatDate, formatDateTime } from "../../lib/format";
import type { CommissionRateChange, CommissionRateSinceReason } from "../../types/api";

const rateText = (rate: number | null | undefined) => (rate === null || rate === undefined ? "theo mặc định" : `${rate}%`);

/** The same words as the exported file (backend commission.rateSince.ts). */
const RATE_SINCE_REASON_TEXT: Record<CommissionRateSinceReason, string> = {
  OVERRIDE_SET: "Đặt tỷ lệ riêng",
  OVERRIDE_REMOVED: "Bỏ tỷ lệ riêng, về mặc định",
  DEFAULT_CHANGED: "Đổi tỷ lệ mặc định",
  JOINED: "Từ khi tham gia"
};

function describeChange(change: CommissionRateChange) {
  const meta = change.metadata ?? {};
  if (change.action === "COMMISSION_DEFAULT_UPDATED") {
    const reach = meta.partnersUsingDefault === undefined ? "" : ` · ${meta.partnersUsingDefault} đối tác dùng mặc định`;
    return `Mặc định: ${meta.previousRate === undefined ? "?" : `${meta.previousRate}%`} → ${meta.rate}%${reach}`;
  }
  // Entries from before the previous rate was recorded show only the new one.
  const previous = "previousRate" in meta ? `${rateText(meta.previousRate)} → ` : "";
  return `${change.businessName ?? change.entityId}: ${previous}${rateText(meta.rate)}`;
}

export function AdminCommissionSettingsPage() {
  const queryClient = useQueryClient();
  const [rate, setRate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const config = useQuery({ queryKey: ["commission-default"], queryFn: adminApi.commissionDefault });
  const history = useQuery({ queryKey: ["commission-history"], queryFn: adminApi.commissionHistory });
  useEffect(() => {
    if (config.data) setRate(String(config.data.rate));
  }, [config.data]);

  const save = useMutation({
    mutationFn: () => adminApi.updateCommissionDefault(Number(rate)),
    onSuccess: () => {
      toast.success("Đã cập nhật tỷ lệ hoa hồng mặc định");
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["commission-default"] });
      queryClient.invalidateQueries({ queryKey: ["commission-history"] });
    },
    onError: (error) => toast.error(error.message)
  });

  const nextRate = Number(rate);
  const validRate = rate.trim() !== "" && Number.isFinite(nextRate) && nextRate >= 0 && nextRate <= 100;
  const changed = config.data !== undefined && validRate && nextRate !== config.data.rate;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Tài chính"
        title="Hoa hồng"
        subtitle="Tỷ lệ mặc định áp dụng cho các đối tác chưa có tỷ lệ riêng. Doanh thu và hoa hồng theo tháng xem ở tab Tài chính."
      />

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">Tỷ lệ mặc định</h2>
        {config.isLoading ? (
          <LoadingState />
        ) : config.isError ? (
          <div className="mt-4"><ErrorState message={config.error.message} onRetry={() => config.refetch()} /></div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              Đang áp dụng <b>{config.data!.rate}%</b>
              {config.data!.defaultSince && (
                <>
                  {" "}từ <b>{formatDateTime(config.data!.defaultSince)}</b>
                  {config.data!.defaultChangedBy ? ` (${config.data!.defaultChangedBy} đổi)` : ""}
                </>
              )}{" "}
              cho <b>{config.data!.partnersUsingDefault}</b> đối tác; <b>{config.data!.overrides.length}</b> đối tác có tỷ lệ riêng không bị ảnh hưởng.
            </p>
            <div className="mt-4 flex max-w-md items-end gap-3">
              <Input
                label="Tỷ lệ mặc định (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={rate}
                onChange={(event) => setRate(event.target.value)}
              />
              <Button disabled={save.isPending || !changed} onClick={() => setConfirming(true)}>
                Lưu thay đổi
              </Button>
            </div>
            {rate.trim() !== "" && !validRate && <p className="mt-2 text-sm text-red-600">Tỷ lệ phải từ 0 đến 100.</p>}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Tỷ lệ của từng đối tác</h2>
            <p className="mt-1 text-sm text-slate-600">Tỷ lệ đang áp dụng và từ khi nào. Đổi hoặc bỏ tỷ lệ riêng trong trang hoa hồng của từng đối tác.</p>
          </div>
          <ReportExportButtons filenameBase={`ty-le-hoa-hong-${new Date().toISOString().slice(0, 10)}`} onExport={adminApi.exportCommission} />
        </div>
        <div className="mt-4">
          {config.isLoading ? (
            <LoadingState />
          ) : config.isError ? null : config.data!.partners.length === 0 ? (
            <EmptyState title="Chưa có đối tác nào." />
          ) : (
            <Table minWidth="760px">
              <THead>
                <tr>
                  <Th>Đối tác</Th>
                  <Th className="text-right">Tỷ lệ</Th>
                  <Th>Loại</Th>
                  <Th>Áp dụng từ</Th>
                  <Th>Người đổi</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </THead>
              <TBody>
                {config.data!.partners.map((partner) => {
                  const diff = Math.round((partner.rate - config.data!.rate) * 100) / 100;
                  return (
                    <Tr key={partner.partnerId}>
                      <Td className="font-medium">{partner.businessName}<br /><span className="text-xs text-slate-500">{partner.partnerId}</span></Td>
                      <Td className="text-right font-semibold">{partner.rate}%</Td>
                      <Td>
                        {partner.source === "DEFAULT" ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Mặc định</span>
                        ) : (
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">
                            Riêng{diff === 0 ? "" : ` · ${diff > 0 ? "+" : ""}${diff}%`}
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {/* Joining is a day; a change is a moment. */}
                        <span className="font-semibold">{partner.sinceReason === "JOINED" ? formatDate(partner.since) : formatDateTime(partner.since)}</span>
                        <br />
                        <span className="text-xs text-slate-500">{RATE_SINCE_REASON_TEXT[partner.sinceReason]}</span>
                      </Td>
                      <Td className="text-sm text-slate-600">{partner.changedBy ?? "—"}</Td>
                      <Td className="text-right">
                        <Link className="font-semibold text-action hover:underline" to={`/admin/partners/${partner.partnerId}/commission`}>
                          Điều chỉnh
                        </Link>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="text-lg font-bold">Lịch sử thay đổi</h2>
        <div className="mt-4">
          {history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState message={history.error.message} onRetry={() => history.refetch()} />
          ) : !history.data?.length ? (
            <EmptyState title="Chưa có thay đổi tỷ lệ nào." />
          ) : (
            <ul className="divide-y divide-line">
              {history.data.map((change) => (
                <li key={change.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <span className="font-medium text-ink">{describeChange(change)}</span>
                  <span className="text-xs text-slate-500">{change.actorName ?? "—"} · {formatDateTime(change.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {confirming && config.data && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold">Đổi tỷ lệ mặc định {config.data.rate}% → {nextRate}%?</h2>
            <div className="mt-2 space-y-2 text-sm text-slate-600">
              <p>
                Áp dụng cho <b>{config.data.partnersUsingDefault}</b> đối tác đang dùng tỷ lệ mặc định. {config.data.overrides.length} đối tác có tỷ lệ
                riêng giữ nguyên.
              </p>
              <p>Các khoản hoa hồng đã ghi nhận giữ tỷ lệ cũ; tỷ lệ mới chỉ tính cho các khoản ghi nhận sau khi lưu.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={save.isPending} onClick={() => setConfirming(false)}>Hủy</Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Đang lưu..." : "Xác nhận"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
