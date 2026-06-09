import { RefreshCcw, Search } from "lucide-react";
import { useLanguage } from "../../lib/i18n";

export function AdminBlockchainLogsPage() {
  const { t } = useLanguage();
  return (
    <div>
      <h1 className="text-5xl font-black">{t("Nhật ký blockchain")}</h1>
      <p className="mt-4 text-xl text-slate-700">{t("Kiểm tra trạng thái ghi nhận hash booking, payment và audit lên blockchain testnet.")}</p>
      <section className="mt-10 rounded-3xl border border-[#dfe8dc] bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex h-14 min-w-80 items-center gap-3 rounded-xl border border-[#b9cdb7] px-5">
            <Search className="h-5 w-5 text-slate-500" />
            <input className="w-full outline-none" placeholder={t("Tìm tx hash, entity, status...")} />
          </label>
          <button className="inline-flex h-14 items-center gap-3 rounded-xl border border-blue-700 px-6 font-bold text-blue-700">
            <RefreshCcw className="h-5 w-5" />
            {t("Thử lại lỗi")}
          </button>
        </div>
        <div className="mt-8 overflow-auto rounded-2xl border border-[#dfe8dc]">
          <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-[#f1fbef]">
              <tr>
                <th className="p-4">{t("Nhật ký kiểm toán")}</th>
                <th>{t("Đối tượng")}</th>
                <th>Payload hash</th>
                <th>{t("Mạng")}</th>
                <th>Tx hash</th>
                <th>{t("Trạng thái")}</th>
                <th>{t("Xác nhận lúc")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={7}>{t("Chưa có endpoint blockchain log trong frontend API. Trang đã sẵn sàng để nối backend.")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
