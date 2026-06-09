import { DetailSection } from "./detailUtils";

export function PricingSection() {
  const rows = [
    ["Ngày thường", "120.000đ - 180.000đ"],
    ["Cuối tuần", "180.000đ - 260.000đ"],
    ["Ngày lễ", "Liên hệ"],
    ["Giờ cao điểm", "+20%"],
    ["Giờ thấp điểm", "Giảm 20%"]
  ];
  return (
    <DetailSection title="Dynamic Pricing" description="Giá thay đổi theo ngày, giờ cao điểm và chính sách từng sân.">
      <div className="grid gap-3 md:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-[1.5rem] bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[1.5rem] bg-blue-50 p-5 text-blue-950">
        <p className="text-xl font-black">Price Trend Chart</p>
        <div className="mt-4 flex h-32 items-end gap-3">
          {[120, 140, 135, 180, 160, 210, 190].map((height, index) => <span key={index} className="flex-1 rounded-t-xl bg-blue-500" style={{ height: height / 2 }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
          <span>Giá trung bình tuần này: 165.000đ</span>
          <span>Giá trung bình tháng này: 172.000đ</span>
        </div>
      </div>
    </DetailSection>
  );
}
