const settlementLabels: Record<string, string> = {
  PENDING: "Chờ quyết toán",
  PROCESSING: "Đang xử lý",
  SETTLED: "Đã quyết toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy"
};

const settlementTones: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-sky-100 text-sky-700",
  SETTLED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-600"
};

const withdrawalLabels: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PROCESSING: "Đang chuyển khoản",
  REJECTED: "Từ chối",
  FAILED: "Chuyển khoản thất bại",
  PAID: "Đã chuyển khoản"
};

const withdrawalTones: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-sky-100 text-sky-700",
  PROCESSING: "bg-violet-100 text-violet-700",
  REJECTED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-100 text-emerald-700"
};

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function SettlementStatusBadge({ status }: { status: string }) {
  return <Badge label={settlementLabels[status] ?? status} tone={settlementTones[status] ?? "bg-slate-100 text-slate-600"} />;
}

export function WithdrawalStatusBadge({ status }: { status: string }) {
  return <Badge label={withdrawalLabels[status] ?? status} tone={withdrawalTones[status] ?? "bg-slate-100 text-slate-600"} />;
}
