import { BadgeCheck, Star } from "lucide-react";
import { partner } from "./detailData";
import { DetailSection } from "./detailUtils";

export function PartnerSection() {
  return (
    <DetailSection title="Đối tác quản lý sân" description="Thông tin chủ sân giúp tăng độ tin cậy khi đặt.">
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-[1.5rem] bg-blue-50 p-5">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-black text-blue-800"><BadgeCheck className="h-4 w-4" /> Verified Partner</p>
          <h3 className="mt-4 text-2xl font-black">{partner.name}</h3>
          <p className="mt-2 text-slate-600">{partner.courts} sân đang quản lý • {partner.bookings.toLocaleString("vi-VN")} lượt đặt</p>
        </div>
        <p className="inline-flex items-center gap-2 text-3xl font-black text-amber-600"><Star className="h-7 w-7 fill-amber-400" /> {partner.rating}</p>
      </div>
    </DetailSection>
  );
}
