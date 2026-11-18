import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { formatDate, formatDateTime } from "../../../lib/format";
import { formatMoney } from "../../../utils/formatters";
import { serviceApi, type ServiceItem, type ServicePriceHistoryEntry, type ServicePriceHistoryKind } from "../api/serviceApi";

const kindMeta: Record<ServicePriceHistoryKind, { label: string; className: string }> = {
  CHANGED: { label: "Đổi giá", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  CREATED: { label: "Giá khi tạo", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  INITIAL: { label: "Mốc ban đầu", className: "bg-slate-100 text-slate-600 ring-slate-200" }
};

/** One line of a service card: when its price was last set. */
export function lastPriceChangeText(change: ServiceItem["lastPriceChange"]) {
  if (!change) return "Chưa có lịch sử giá";
  if (change.kind === "CHANGED") return `Đổi giá lần cuối: ${formatDateTime(change.changedAt)}`;
  if (change.kind === "CREATED") return `Giá đặt khi tạo: ${formatDateTime(change.changedAt)}`;
  return `Chưa đổi giá từ ${formatDate(change.changedAt)}`;
}

/** A price on one line of the history: old → new when this change moved it, otherwise the price it stood at. */
function PriceMove({ entry, field }: { entry: ServicePriceHistoryEntry; field: "price" | "costPrice" }) {
  const moved = field === "price" ? entry.priceChanged : entry.costPriceChanged;
  const before = field === "price" ? entry.oldPrice : entry.oldCostPrice;
  const after = field === "price" ? entry.newPrice : entry.newCostPrice;
  if (moved && before != null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <s className="text-slate-400">{formatMoney(before)}</s>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-label="thành" />
        <strong className="text-slate-900">{formatMoney(after)}</strong>
        <span className="text-xs font-semibold text-slate-500">({after > before ? "tăng" : "giảm"} {formatMoney(Math.abs(after - before))})</span>
      </span>
    );
  }
  return (
    <span className="text-slate-700">
      {formatMoney(after)}
      {entry.kind === "CHANGED" ? <span className="ml-1 text-xs text-slate-400">(không đổi)</span> : null}
    </span>
  );
}

/**
 * "Lịch sử giá" of a service: each time its sale price or cost price was set, newest first, with the time, old and new
 * prices and who changed it. Read only.
 */
export function ServicePriceHistoryModal({ service, onClose }: { service: ServiceItem | null; onClose: () => void }) {
  const history = useQuery({
    queryKey: ["service-price-history", service?.id],
    queryFn: () => serviceApi.priceHistory(service!.id),
    enabled: Boolean(service)
  });
  const entries = history.data?.entries ?? [];

  return (
    <Modal isOpen={Boolean(service)} onClose={onClose} title={`Lịch sử giá · ${service?.name ?? ""}`} maxWidth="max-w-xl">
      {service?.court?.name ? <p className="-mt-1 mb-3 text-xs font-semibold text-slate-500">{service.court.name}</p> : null}

      {history.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : history.isError ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          Không tải được lịch sử giá.{" "}
          <button type="button" className="underline" onClick={() => void history.refetch()}>
            Thử lại
          </button>
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">Chưa có lần đặt giá nào được ghi nhận.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${kindMeta[entry.kind].className}`}>{kindMeta[entry.kind].label}</span>
                <time dateTime={entry.changedAt} className="text-xs font-bold text-slate-600">
                  {formatDateTime(entry.changedAt)}
                </time>
              </div>
              <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-y-1 text-sm">
                <dt className="text-slate-500">Giá bán</dt>
                <dd>
                  <PriceMove entry={entry} field="price" />
                </dd>
                <dt className="text-slate-500">Giá nhập</dt>
                <dd>
                  <PriceMove entry={entry} field="costPrice" />
                </dd>
              </dl>
              <p className="mt-1.5 text-xs text-slate-500">
                {entry.changedBy
                  ? `Người đổi: ${entry.changedBy.fullName}`
                  : entry.kind === "INITIAL"
                    ? "Giá có sẵn khi bắt đầu ghi nhận; thời điểm là lúc bắt đầu ghi, không phải lúc giá được đặt."
                    : "Không rõ người đổi"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
