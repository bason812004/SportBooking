export function PaginationSection() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-center shadow-sm">
      <p className="font-bold text-slate-600">Đang bật Infinite Scroll. Kéo xuống để tải thêm sân phù hợp.</p>
      <div className="mt-4 flex justify-center gap-2">
        {[1, 2, 3].map((page) => <button key={page} className={`h-10 w-10 rounded-xl font-black ${page === 1 ? "bg-[#0f766e] text-white" : "bg-slate-50"}`}>{page}</button>)}
      </div>
    </div>
  );
}
