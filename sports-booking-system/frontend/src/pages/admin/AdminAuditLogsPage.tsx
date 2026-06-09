import { CheckCircle2, Search } from "lucide-react";
import { useLanguage } from "../../lib/i18n";

export function AdminAuditLogsPage() {
  const { t } = useLanguage();
  return (
    <div>
      <h1 className="text-5xl font-black">{t("Nhật ký kiểm toán")}</h1>
      <p className="mt-4 text-xl text-slate-700">{t("Theo dõi lịch sử hành động quan trọng trong hệ thống.")}</p>
      <section className="mt-10 rounded-3xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex h-14 min-w-80 items-center gap-3 rounded-xl border border-[#b9cdb7] px-5">
            <Search className="h-5 w-5 text-slate-500" />
            <input className="w-full outline-none" placeholder={t("Tìm action, actor, entity...")} />
          </label>
          <button className="inline-flex h-14 items-center gap-3 rounded-xl bg-[#02712a] px-6 font-bold text-white">
            <CheckCircle2 className="h-5 w-5" />
            {t("Xác minh chuỗi audit")}
          </button>
        </div>
        <div className="mt-8 overflow-auto rounded-2xl border border-[#dfe8dc]">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-[#f1fbef]">
              <tr>
                <th className="p-4">{t("Hành động")}</th>
                <th>{t("Người thực hiện")}</th>
                <th>{t("Vai trò")}</th>
                <th>{t("Đối tượng")}</th>
                <th>{t("Hash trước")}</th>
                <th>{t("Hash hiện tại")}</th>
                <th>{t("Tạo lúc")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={7}>{t("Chưa có endpoint audit log trong frontend API. Trang đã sẵn sàng để nối backend.")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
