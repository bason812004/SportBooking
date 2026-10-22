import { DetailSection } from "./detailUtils";

type CourtPrice = {
  id: string;
  dayType: string;
  startTime: string;
  endTime: string;
  price: string;
  note?: string;
};

function timeText(value: string) {
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

function dayTypeText(value: string) {
  const map: Record<string, string> = {
    WEEKDAY: "Ngày thường",
    WEEKEND: "Cuối tuần",
    HOLIDAY: "Ngày lễ"
  };
  return map[value] ?? value;
}

export function PricingSection({ prices }: { prices: CourtPrice[] }) {
  return (
    <DetailSection title="Bảng giá" description="Bảng giá đang lấy trực tiếp từ cấu hình giá của sân trong cơ sở dữ liệu.">
      {prices.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {prices.map((row) => (
            <div key={row.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">{dayTypeText(row.dayType)}</p>
              <p className="mt-2 text-xl font-black text-[#0f766e]">{Number(row.price).toLocaleString("vi-VN")}đ/giờ</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {timeText(row.startTime)} - {timeText(row.endTime)}
              </p>
              {row.note && <p className="mt-2 text-sm text-slate-500">{row.note}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 font-semibold text-slate-600">
          Chủ sân chưa cập nhật bảng giá cho sân này.
        </p>
      )}
    </DetailSection>
  );
}
