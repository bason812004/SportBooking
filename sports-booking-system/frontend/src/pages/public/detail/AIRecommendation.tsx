import { BrainCircuit, Sparkles } from "lucide-react";
import { DetailSection } from "./detailUtils";

export function AIRecommendation() {
  return (
    <DetailSection title="AI Recommendation" description="Dựa trên lịch sử đặt sân và khu vực bạn thường chơi.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] bg-blue-50 p-5 text-blue-950">
          <Sparkles className="h-7 w-7" />
          <h3 className="mt-4 text-2xl font-black">Khung giờ phù hợp cho bạn</h3>
          <p className="mt-2 text-lg font-bold">14:00 - 16:00 • Giảm 20%</p>
        </div>
        <div className="rounded-[1.5rem] bg-emerald-50 p-5 text-emerald-950">
          <BrainCircuit className="h-7 w-7" />
          <h3 className="mt-4 text-2xl font-black">Vì sao gợi ý?</h3>
          <p className="mt-2">Khung này ít đông, giá thấp hơn và phù hợp với lịch đặt trước đây của bạn.</p>
        </div>
      </div>
    </DetailSection>
  );
}
