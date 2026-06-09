import { TrendingUp } from "lucide-react";
import { DetailSection } from "./detailUtils";

export function QuickStats({ price, rating }: { price: string; rating: number | string }) {
  const stats = [
    { label: "Giá từ", value: price },
    { label: "Tỷ lệ kín sân", value: "85%" },
    { label: "Lượt đặt tháng này", value: "1.284" },
    { label: "Đánh giá trung bình", value: rating }
  ];
  return (
    <DetailSection title="Quick stats" description="Các chỉ số quan trọng giúp người dùng ra quyết định nhanh.">
      <div className="grid gap-3 md:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-[1.5rem] bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-[#0b1220]">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[1.5rem] bg-orange-50 p-5 text-orange-900">
        <p className="flex items-center gap-2 text-xl font-black"><TrendingUp className="h-5 w-5" /> Court Availability Predictor</p>
        <p className="mt-2 text-3xl font-black">Khả năng hết sân tối nay: 92%</p>
      </div>
    </DetailSection>
  );
}
