import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, RefreshCw, Calendar, Search } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { checkoutApi } from "../../features/checkout/api/checkoutApi";
import { formatMoney } from "../../utils/formatters";

export function PartnerCheckoutsPage() {
  const [checkouts, setCheckouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await checkoutApi.getPartnerCheckouts();
      setCheckouts(data);
    } catch (err) {
      console.error("Failed to load checkouts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCheckouts = checkouts.filter((c) =>
    c.booking?.bookingCode?.toLowerCase().includes(search.toLowerCase()) ||
    c.booking?.user?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản Lý Lịch Sử Checkout & Thanh Toán</h1>
          <p className="text-sm font-medium text-slate-600">
            Tổng hợp thông tin tiền sân, tiền dịch vụ, cọc đã thu và thanh toán hoàn tất sau khi kết thúc sử dụng sân.
          </p>
        </div>
        <Button className="flex items-center gap-2 bg-[#02712a] text-white" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" /> Làm mới
        </Button>
      </div>

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Tìm theo mã đơn hoặc tên khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-4">Mã đơn</th>
              <th className="p-4">Khách hàng</th>
              <th className="p-4">Sân</th>
              <th className="p-4">Tiền sân</th>
              <th className="p-4">Tiền dịch vụ</th>
              <th className="p-4">Đã cọc</th>
              <th className="p-4">Tổng cộng</th>
              <th className="p-4">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Đang tải lịch sử checkout...
                </td>
              </tr>
            ) : filteredCheckouts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Chưa có lịch sử checkout nào
                </td>
              </tr>
            ) : (
              filteredCheckouts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-4 font-extrabold text-[#02712a]">#{c.booking?.bookingCode}</td>
                  <td className="p-4">
                    <p className="font-bold text-slate-900">{c.booking?.user?.fullName}</p>
                    <p className="text-xs text-slate-500">{c.booking?.user?.phone || "---"}</p>
                  </td>
                  <td className="p-4 font-bold text-slate-800">{c.booking?.court?.name}</td>
                  <td className="p-4">{formatMoney(c.subtotalCourt)}</td>
                  <td className="p-4 text-blue-600">{formatMoney(c.subtotalService)}</td>
                  <td className="p-4 text-slate-600">{formatMoney(c.depositPaid)}</td>
                  <td className="p-4 font-extrabold text-slate-900 text-base">{formatMoney(c.totalAmount)}</td>
                  <td className="p-4">
                    {c.status === "COMPLETED" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                        Đã thanh toán đủ
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800">
                        Chờ thanh toán
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
