import { BadgeCheck, Building2, Mail, Phone } from "lucide-react";
import type { Court } from "../../../types/api";
import { DetailSection } from "./detailUtils";

export function PartnerSection({ partner }: { partner?: Court["partner"] }) {
  return (
    <DetailSection title="Đối tác quản lý sân" description="Thông tin chủ sân được lấy từ hồ sơ đối tác trong cơ sở dữ liệu.">
      {partner ? (
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-black text-emerald-800">
              <BadgeCheck className="h-4 w-4" />
              Đối tác đã xác thực
            </p>
            <h3 className="mt-4 break-words text-2xl font-black">{partner.businessName}</h3>
            {partner.user?.fullName && <p className="mt-2 font-semibold text-slate-700">Người phụ trách: {partner.user.fullName}</p>}
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
              {partner.user?.phone && (
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#0f766e]" />
                  {partner.user.phone}
                </span>
              )}
              {partner.user?.email && (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#0f766e]" />
                  {partner.user.email}
                </span>
              )}
            </div>
          </div>
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-[#0f766e] shadow-sm">
            <Building2 className="h-8 w-8" />
          </span>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 font-semibold text-slate-600">
          Sân này chưa có hồ sơ đối tác công khai.
        </p>
      )}
    </DetailSection>
  );
}
