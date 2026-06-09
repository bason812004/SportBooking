import { services } from "./detailData";
import { DetailSection } from "./detailUtils";

export function ServicesSection() {
  return (
    <DetailSection title="Dịch vụ đi kèm" description="Người dùng có thể chọn thêm dịch vụ và tổng tiền cập nhật ở booking panel.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {services.map((service) => (
          <label key={service.name} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#0f766e]">
            <input type="checkbox" className="accent-[#0f766e]" />
            <p className="mt-3 font-black">{service.name}</p>
            <p className="text-sm text-slate-500">{service.price.toLocaleString("vi-VN")}đ</p>
          </label>
        ))}
      </div>
    </DetailSection>
  );
}
