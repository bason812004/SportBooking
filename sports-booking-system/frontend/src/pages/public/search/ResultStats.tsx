export function ResultStats({ total, averagePrice, averageDistance, averageRating }: { total: number; averagePrice: string; averageDistance: string; averageRating: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Stat label="Kết quả" value={`Tìm thấy ${total} sân phù hợp`} />
      <Stat label="Giá trung bình" value={averagePrice} />
      <Stat label="Khoảng cách" value={averageDistance} />
      <Stat label="Rating TB" value={averageRating} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-[#0b1220]">{value}</p>
    </div>
  );
}
