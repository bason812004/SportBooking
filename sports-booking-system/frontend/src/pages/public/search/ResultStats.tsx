export function ResultStats({ total, averagePrice, averageDistance, averageRating }: { total: number; averagePrice: string; averageDistance: string; averageRating: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Stat label="Kết quả" value={`Tìm thấy ${total} sân phù hợp`} wide />
      <Stat label="Giá trung bình" value={averagePrice} />
      <Stat label="Khoảng cách TB" value={averageDistance} />
      <Stat label="Rating TB" value={averageRating} />
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`${wide ? "sm:col-span-1" : ""} rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-[#0b1220]">{value}</p>
    </div>
  );
}
