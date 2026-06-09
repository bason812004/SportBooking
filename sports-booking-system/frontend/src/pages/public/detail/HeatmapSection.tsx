import { heatmap } from "./detailData";
import { DetailSection } from "./detailUtils";

export function HeatmapSection() {
  return (
    <DetailSection title="Heatmap theo giờ" description="Nhìn nhanh giờ đông nhất để chọn khung phù hợp hơn.">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
        {heatmap.map((item) => (
          <div key={item.time} className="rounded-2xl p-4 text-center font-black text-white" style={{ backgroundColor: `rgb(${70 + item.level * 1.7}, ${180 - item.level}, 70)` }}>
            <p>{item.time}</p>
            <p className="text-sm">{item.level}%</p>
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
