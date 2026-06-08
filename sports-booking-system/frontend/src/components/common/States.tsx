import { Loader2 } from "lucide-react";
import { Button } from "../ui/Button";

export function LoadingState({ label = "Dang tai du lieu" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p>{message}</p>
      {onRetry && (
        <Button className="mt-3" variant="secondary" onClick={onRetry}>
          Thu lai
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title = "Chua co du lieu" }: { title?: string }) {
  return <div className="rounded-md border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500">{title}</div>;
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
