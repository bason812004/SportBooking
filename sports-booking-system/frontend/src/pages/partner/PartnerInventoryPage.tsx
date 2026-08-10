import { useEffect, useState } from "react";
import { Boxes, AlertTriangle, ArrowUpRight, ArrowDownLeft, RefreshCw, History, ShieldAlert, DollarSign } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { inventoryApi, type InventoryItem, type InventorySummary, type InventoryTransaction } from "../../features/inventory/api/inventoryApi";
import { formatMoney } from "../../utils/formatters";

export function PartnerInventoryPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"STOCK" | "TRANSACTIONS">("STOCK");

  // Adjust Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    type: "IMPORT",
    quantity: 10,
    unitCost: 0,
    note: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invData, txData] = await Promise.all([
        inventoryApi.getSummary(),
        inventoryApi.getTransactions(50)
      ]);
      setSummary(invData.summary);
      setItems(invData.items);
      setTransactions(txData);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustForm({
      type: "IMPORT",
      quantity: 10,
      unitCost: item.costPrice,
      note: ""
    });
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await inventoryApi.adjustStock({
        serviceId: selectedItem.serviceId,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        unitCost: Number(adjustForm.unitCost),
        note: adjustForm.note
      });
      setIsAdjustModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi điều chỉnh tồn kho");
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterStatus === "LOW_STOCK") return item.status === "LOW_STOCK";
    if (filterStatus === "OUT_OF_STOCK") return item.status === "OUT_OF_STOCK";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản Lý Tồn Kho & Hàng Hóa</h1>
          <p className="text-sm font-medium text-slate-600">
            Theo dõi số lượng tồn kho, cảnh báo sắp hết hàng, giá vốn và lịch sử xuất nhập kho.
          </p>
        </div>
        <Button className="flex items-center gap-2 bg-[#02712a] text-white" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" /> Làm mới dữ liệu
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Tổng sản phẩm</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{summary.totalProducts}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Tổng số lượng: {summary.totalItems} đơn vị</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Giá trị kho (Giá vốn)</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#02712a]">{formatMoney(summary.totalStockValue)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Dựa trên giá nhập hàng hiện tại</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Cảnh báo sắp hết</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-amber-600">{summary.lowStockCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Sản phẩm ≤ Mức tồn tối thiểu</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Đã hết hàng</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-rose-600">{summary.outOfStockCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Cần nhập thêm ngay</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("STOCK")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "STOCK"
              ? "border-[#02712a] text-[#02712a]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Boxes className="h-4 w-4" /> Danh sách tồn kho
        </button>
        <button
          onClick={() => setActiveTab("TRANSACTIONS")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "TRANSACTIONS"
              ? "border-[#02712a] text-[#02712a]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <History className="h-4 w-4" /> Lịch sử xuất/nhập
        </button>
      </div>

      {activeTab === "STOCK" && (
        <div className="space-y-4">
          {/* Quick Filter Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filterStatus === "ALL" ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilterStatus("LOW_STOCK")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filterStatus === "LOW_STOCK" ? "bg-amber-600 text-white" : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              Sắp hết hàng ({summary?.lowStockCount || 0})
            </button>
            <button
              onClick={() => setFilterStatus("OUT_OF_STOCK")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                filterStatus === "OUT_OF_STOCK" ? "bg-rose-600 text-white" : "bg-white text-slate-700 border border-slate-200"
              }`}
            >
              Hết hàng ({summary?.outOfStockCount || 0})
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4">Sản phẩm</th>
                  <th className="p-4">Danh mục</th>
                  <th className="p-4">Số lượng tồn</th>
                  <th className="p-4">Giá vốn (Nhập)</th>
                  <th className="p-4">Giá bán</th>
                  <th className="p-4">Tổng giá trị tồn</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-normal">
                      Không có sản phẩm nào phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.serviceId} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-bold text-slate-900">{item.serviceName}</td>
                      <td className="p-4 text-slate-600">{item.categoryName}</td>
                      <td className="p-4">
                        <span className="text-base font-extrabold text-slate-900">{item.quantity}</span>{" "}
                        <span className="text-xs text-slate-500">{item.unit}</span>
                      </td>
                      <td className="p-4">{formatMoney(item.costPrice)}</td>
                      <td className="p-4 text-[#02712a]">{formatMoney(item.price)}</td>
                      <td className="p-4 font-bold text-slate-900">{formatMoney(item.stockValue)}</td>
                      <td className="p-4">
                        {item.status === "OUT_OF_STOCK" && (
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                            Hết hàng
                          </span>
                        )}
                        {item.status === "LOW_STOCK" && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700">
                            Sắp hết
                          </span>
                        )}
                        {item.status === "NORMAL" && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                            Đủ hàng
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          className="bg-slate-100 text-slate-800 hover:bg-slate-200"
                          onClick={() => handleOpenModalAdjust(item)}
                        >
                          Khởi tạo / Điều chỉnh
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "TRANSACTIONS" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Sản phẩm</th>
                <th className="p-4">Loại giao dịch</th>
                <th className="p-4">Số lượng</th>
                <th className="p-4">Giá vốn đơn vị</th>
                <th className="p-4">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-normal">
                    Chưa có giao dịch tồn kho nào được ghi nhận
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString("vi-VN")}</td>
                    <td className="p-4 font-bold text-slate-900">{tx.service?.name}</td>
                    <td className="p-4">
                      {["IMPORT", "RENTAL_IN"].includes(tx.type) ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                          <ArrowDownLeft className="h-4 w-4" /> Nhập kho ({tx.type})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600">
                          <ArrowUpRight className="h-4 w-4" /> Xuất kho ({tx.type})
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-extrabold text-base">
                      {tx.quantity} {tx.service?.unit}
                    </td>
                    <td className="p-4">{formatMoney(tx.unitCost)}</td>
                    <td className="p-4 text-xs text-slate-500">{tx.note || "---"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Điều Chỉnh Tồn Kho - ${selectedItem?.serviceName}`}
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Loại thao tác (*)</label>
            <select
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
              value={adjustForm.type}
              onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
            >
              <option value="IMPORT">Nhập thêm kho (Kèm điều chỉnh giá nhập)</option>
              <option value="ADJUSTMENT">Thay đổi đặt trực tiếp số lượng tồn</option>
              <option value="SALE">Xuất bán thủ công</option>
              <option value="DAMAGED">Ghi nhận Hỏng hóc</option>
              <option value="LOST">Ghi nhận Thất thoát / Mất</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Số lượng (*)</label>
              <Input
                type="number"
                required
                min={0}
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Giá vốn mới (VNĐ)</label>
              <Input
                type="number"
                min={0}
                value={adjustForm.unitCost}
                onChange={(e) => setAdjustForm({ ...adjustForm, unitCost: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Ghi chú kiểm kho / Lý do</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-green-600 focus:outline-none"
              placeholder="VD: Kiểm kê định kỳ, hàng hỏng do móp vỡ..."
              value={adjustForm.note}
              onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsAdjustModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white">
              Cập nhật kho
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );

  function handleOpenModalAdjust(item: InventoryItem) {
    handleOpenAdjust(item);
  }
}
