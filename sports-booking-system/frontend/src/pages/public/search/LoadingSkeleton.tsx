export function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[260px_1fr]">
          <div className="h-56 animate-pulse rounded-[1.35rem] bg-slate-200" />
          <div className="space-y-4 p-3">
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, item) => <div key={item} className="h-9 animate-pulse rounded-full bg-slate-100" />)}
            </div>
            <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
