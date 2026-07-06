import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationSection({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => {
    if (totalPages <= 7) return true;
    return item === 1 || item === totalPages || Math.abs(item - page) <= 1;
  });

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-slate-600">Trang {page} / {totalPages}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Trước
          </button>
          {pages.map((item, index) => {
            const previous = pages[index - 1];
            const showGap = previous && item - previous > 1;
            return (
              <span key={item} className="inline-flex gap-2">
                {showGap && <span className="grid h-10 w-8 place-items-center font-black text-slate-400">...</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`h-10 w-10 rounded-xl font-black ${item === page ? "bg-[#0f766e] text-white" : "bg-slate-50 text-slate-700 hover:bg-emerald-50"}`}
                >
                  {item}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sau
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
