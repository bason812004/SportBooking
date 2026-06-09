import { heatmapHours } from "./searchData";

export function HeatmapSection() {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Heatmap khung giờ đông nhất</h2>
      <p className="mt-2 text-sm text-slate-500">17h - 22h thường có nhu cầu cao nhất, nên đặt sớm để giữ chỗ đẹp.</p>
      <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {heatmapHours.map((item) => (
          <div key={item.time} className="rounded-2xl p-3 text-center text-xs font-black text-white" style={{ backgroundColor: `rgb(${80 + item.level * 1.6}, ${180 - item.level}, 70)` }}>
            <p>{item.time}</p>
            <p>{item.level}%</p>
          </div>
        ))}
      </div>
    </section>
  );
}
