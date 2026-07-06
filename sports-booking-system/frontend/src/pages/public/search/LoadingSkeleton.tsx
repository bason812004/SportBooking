export function LoadingSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
          <div className="aspect-[16/10] animate-pulse bg-slate-200" />
          <div className="space-y-4 p-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, item) => <div key={item} className="h-8 animate-pulse rounded-full bg-slate-100" />)}
            </div>
            <div className="h-20 w-full animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
