import { amenities } from "./detailData";
import { DetailSection } from "./detailUtils";

export function AmenitiesSection() {
  return (
    <DetailSection title="Tiện ích" description="Icon grid giúp người dùng kiểm tra nhanh các điều kiện cần trước khi đặt.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {amenities.map((item) => (
          <div key={item.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold">
            <item.icon className="h-5 w-5 text-[#0f766e]" />
            {item.name}
          </div>
        ))}
      </div>
    </DetailSection>
  );
}
