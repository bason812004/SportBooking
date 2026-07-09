import { Bath, Car, Dumbbell, Fan, Lightbulb, Shirt, ShowerHead, Wifi, Wine, type LucideIcon } from "lucide-react";
import { DetailSection } from "./detailUtils";

type Amenity = { id?: string; name: string };

const amenityIcons: Array<{ test: RegExp; icon: LucideIcon }> = [
  { test: /wifi/i, icon: Wifi },
  { test: /bãi|bai|xe|parking/i, icon: Car },
  { test: /thay đồ|thay do|locker/i, icon: Shirt },
  { test: /tắm|tam|bath/i, icon: Bath },
  { test: /nước|nuoc|drink/i, icon: Wine },
  { test: /máy lạnh|may lanh|điều hòa|dieu hoa|fan/i, icon: Fan },
  { test: /đèn|den|light/i, icon: Lightbulb },
  { test: /nghỉ|nghi|shower/i, icon: ShowerHead }
];

function iconFor(name: string) {
  return amenityIcons.find((item) => item.test.test(name))?.icon ?? Dumbbell;
}

export function AmenitiesSection({ amenities }: { amenities: Amenity[] }) {
  return (
    <DetailSection title="Tiện ích" description="Dữ liệu tiện ích được lấy trực tiếp từ hồ sơ sân trong cơ sở dữ liệu.">
      {amenities.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {amenities.map((item) => {
            const Icon = iconFor(item.name);
            return (
              <div key={item.id ?? item.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold">
                <Icon className="h-5 w-5 text-[#0f766e]" />
                {item.name}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 font-semibold text-slate-600">
          Chủ sân chưa cập nhật tiện ích cho sân này.
        </p>
      )}
    </DetailSection>
  );
}
