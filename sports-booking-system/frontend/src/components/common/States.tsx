import { Loader2 } from "lucide-react";
import { useLanguage } from "../../lib/i18n";
import { Button } from "../ui/Button";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? t("Đang tải dữ liệu")}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <Button className="mt-3" variant="secondary" onClick={onRetry}>
          {t("Thử lại")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-base font-bold text-slate-700">{title ?? t("Chưa có dữ liệu")}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-md bg-slate-200" />
      ))}
    </div>
  );
}
