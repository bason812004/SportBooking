import { useEffect, useState } from "react";
import { Truck, Plus, FileText, ShoppingCart, UserCheck, DollarSign, Calendar } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { inventoryApi, type PurchaseOrder, type Supplier } from "../../features/inventory/api/inventoryApi";
import { serviceApi, type ServiceItem } from "../../features/services/api/serviceApi";
import { formatMoney } from "../../utils/formatters";

export function PartnerPurchasesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ORDERS" | "SUPPLIERS">("ORDERS");

  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "" });

  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poNote, setPoNote] = useState("");
  const [poItems, setPoItems] = useState<Array<{ serviceId: string; quantity: number; unitCost: number }>>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supList, poList, svcList] = await Promise.all([
        inventoryApi.getSuppliers(),
        inventoryApi.getPurchaseOrders(),
        serviceApi.getPartnerServices()
      ]);
      setSuppliers(supList);
      setPurchaseOrders(poList);
      setServices(svcList);
    } catch (err) {
      console.error("Failed to load purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createSupplier(supplierForm);
      setIsSupplierModalOpen(false);
      setSupplierForm({ name: "", contactName: "", phone: "", email: "", address: "" });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi tạo nhà cung cấp");
    }
  };

  const handleAddPOItem = () => {
    if (services.length === 0) return;
    setPoItems([...poItems, { serviceId: services[0].id, quantity: 10, unitCost: services[0].costPrice || 0 }]);
  };

  const handleRemovePOItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleUpdatePOItem = (index: number, field: string, value: any) => {
    const next = [...poItems];
    if (field === "serviceId") {
      const svc = services.find((s) => s.id === value);
      next[index] = { ...next[index], serviceId: value, unitCost: svc?.costPrice || 0 };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setPoItems(next);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      alert("Vui lòng thêm ít nhất 1 sản phẩm vào đơn nhập hàng");
      return;
    }
    try {
      await inventoryApi.createPurchaseOrder({
        supplierId: poSupplierId || undefined,
        note: poNote,
        items: poItems.map((item) => ({
          serviceId: item.serviceId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost)
        }))
      });
      setIsPOModalOpen(false);
      setPoItems([]);
      setPoNote("");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi tạo đơn nhập hàng");
    }
  };

  const calculatePOTotal = () => {
    return poItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản Lý Nhập Hàng & Nhà Cung Cấp</h1>
          <p className="text-sm font-medium text-slate-600">
            Theo dõi chi phí nhập hàng, quản lý danh sách nhà cung cấp, tự động tính toán giá vốn và lợi nhuận.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => setIsSupplierModalOpen(true)}>
            <UserCheck className="h-4 w-4" /> Thêm NCC
          </Button>
          <Button
            className="flex items-center gap-2 bg-[#02712a] text-white"
            onClick={() => {
              setPoItems(services.length > 0 ? [{ serviceId: services[0].id, quantity: 10, unitCost: services[0].costPrice || 0 }] : []);
              setIsPOModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nhập hàng mới
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "ORDERS"
              ? "border-[#02712a] text-[#02712a]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShoppingCart className="h-4 w-4" /> Đơn nhập hàng ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("SUPPLIERS")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "SUPPLIERS"
              ? "border-[#02712a] text-[#02712a]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Truck className="h-4 w-4" /> Nhà cung cấp ({suppliers.length})
        </button>
      </div>

      {activeTab === "ORDERS" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-extrabold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-4">Mã đơn</th>
                  <th className="p-4">Ngày nhập</th>
                  <th className="p-4">Nhà cung cấp</th>
                  <th className="p-4">Số sản phẩm</th>
                  <th className="p-4">Tổng tiền vốn</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-normal">
                      Chưa có đơn nhập hàng nào
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-extrabold text-[#02712a]">{po.orderCode}</td>
                      <td className="p-4 text-xs text-slate-500">{new Date(po.createdAt).toLocaleString("vi-VN")}</td>
                      <td className="p-4 font-bold text-slate-900">{po.supplier?.name || "Nhập lẻ / Tự do"}</td>
                      <td className="p-4">{po.items?.length || 0} mặt hàng</td>
                      <td className="p-4 font-extrabold text-slate-900 text-base">{formatMoney(po.totalAmount)}</td>
                      <td className="p-4">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                          Hoàn tất (Đã cộng kho)
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">{po.note || "---"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "SUPPLIERS" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Chưa có nhà cung cấp nào. Thêm nhà cung cấp để quản lý nguồn hàng dễ dàng hơn.
            </div>
          ) : (
            suppliers.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                  <span className="rounded-lg bg-green-50 px-2 py-0.5 text-xs font-bold text-[#02712a]">NCC</span>
                </div>
                {s.contactName && <p className="text-xs text-slate-600">Đại diện: {s.contactName}</p>}
                {s.phone && <p className="text-xs text-slate-600">SĐT: {s.phone}</p>}
                {s.email && <p className="text-xs text-slate-600">Email: {s.email}</p>}
                {s.address && <p className="text-xs text-slate-500 line-clamp-1">ĐC: {s.address}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Add Supplier */}
      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Thêm Nhà Cung Cấp Mới">
        <form onSubmit={handleCreateSupplier} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tên công ty / NCC (*)</label>
            <Input
              required
              placeholder="VD: Công ty TNHH Đồ Uống Tân Hiệp Phát..."
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Người liên hệ</label>
              <Input
                placeholder="Nguyễn Văn A"
                value={supplierForm.contactName}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Số điện thoại</label>
              <Input
                placeholder="090XXXXXXX"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email</label>
            <Input
              type="email"
              placeholder="ncc@domain.com"
              value={supplierForm.email}
              onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Địa chỉ</label>
            <Input
              placeholder="Số 123 Đường ABC, Quận XYZ..."
              value={supplierForm.address}
              onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsSupplierModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white">
              Tạo nhà cung cấp
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Add Purchase Order */}
      <Modal isOpen={isPOModalOpen} onClose={() => setIsPOModalOpen(false)} title="Tạo Đơn Nhập Hàng (Tăng Tồn Kho)">
        <form onSubmit={handleCreatePO} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nhà cung cấp</label>
            <select
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
            >
              <option value="">-- Nhập lẻ / Không chọn NCC --</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700">Danh sách sản phẩm nhập (*)</label>
              <Button type="button" size="sm" variant="secondary" onClick={handleAddPOItem}>
                + Thêm dòng
              </Button>
            </div>

            {poItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                <select
                  className="flex-1 rounded-lg border border-slate-300 p-2 text-xs font-bold"
                  value={item.serviceId}
                  onChange={(e) => handleUpdatePOItem(idx, "serviceId", e.target.value)}
                >
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({svc.unit})
                    </option>
                  ))}
                </select>

                <Input
                  type="number"
                  min={1}
                  className="w-20 p-2 text-xs"
                  placeholder="SL"
                  value={item.quantity}
                  onChange={(e) => handleUpdatePOItem(idx, "quantity", Number(e.target.value))}
                />

                <Input
                  type="number"
                  min={0}
                  className="w-28 p-2 text-xs"
                  placeholder="Giá nhập"
                  value={item.unitCost}
                  onChange={(e) => handleUpdatePOItem(idx, "unitCost", Number(e.target.value))}
                />

                <button
                  type="button"
                  onClick={() => handleRemovePOItem(idx)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm font-bold text-[#02712a]">
            <span>Tổng tiền đơn nhập:</span>
            <span className="text-lg">{formatMoney(calculatePOTotal())}</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Ghi chú đơn nhập</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-slate-300 p-2 text-sm"
              placeholder="VD: Đã thanh toán chuyển khoản..."
              value={poNote}
              onChange={(e) => setPoNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsPOModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white">
              Hoàn tất nhập hàng
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
