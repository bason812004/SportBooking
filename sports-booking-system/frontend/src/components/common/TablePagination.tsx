import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  /** Noun for the counted items, e.g. "đơn". */
  itemLabel?: string;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
};

// First, last and the neighbours of the current page; skipped ranges render as "…".
function visiblePages(page: number, totalPages: number) {
  return Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (item) => totalPages <= 7 || item === 1 || item === totalPages || Math.abs(item - page) <= 1
  );
}

export function TablePagination({
  page,
  totalPages,
  total,
  limit,
  itemLabel = "mục",
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onLimitChange
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = visiblePages(page, Math.max(totalPages, 1));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <div className="flex flex-wrap items-center gap-4">
        <span>
          Hiển thị <b className="text-slate-800">{from}–{to}</b> / <b className="text-slate-800">{total}</b> {itemLabel}
        </span>
        {onLimitChange && (
          <label className="flex items-center gap-2">
            Mỗi trang
            <select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-action"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="secondary" size="sm" className="px-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((item, index) => (
          <span key={item} className="inline-flex items-center gap-1.5">
            {index > 0 && item - pages[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
            <Button
              variant={item === page ? "primary" : "secondary"}
              size="sm"
              className="min-w-8 px-2"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          </span>
        ))}
        <Button variant="secondary" size="sm" className="px-2" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Trang sau">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
