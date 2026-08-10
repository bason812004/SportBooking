import { useEffect, useState } from "react";
import { Plus, Search, Tag, Edit3, Trash2, Box, Check, X, ShieldAlert, Layers } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../../features/services/api/serviceApi";
import { formatMoney } from "../../utils/formatters";

export function PartnerServicesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    type: "PRODUCT" as "PRODUCT" | "RENTAL_SERVICE",
    sportType: "ALL",
    price: 0,
    costPrice: 0,
    unit: "cái",
    imageUrl: "",
    initialStock: 50,
    minimumStock: 5,
    description: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cats, svcs] = await Promise.all([
        serviceApi.getCategories(),
        serviceApi.getPartnerServices({ categoryId: selectedCategory, search })
      ]);
      setCategories(cats);
      setServices(svcs);
    } catch (err) {
      console.error("Failed to load services data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategory, search]);

  const handleOpenModal = (service?: ServiceItem) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        categoryId: service.categoryId || "",
        type: service.type,
        sportType: service.sportType || "ALL",
        price: service.price,
        costPrice: service.costPrice || 0,
        unit: service.unit || "cái",
        imageUrl: service.imageUrl || "",
        initialStock: service.inventory?.quantity || 0,
        minimumStock: service.inventory?.minimumStock || 5,
        description: service.description || ""
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        categoryId: categories[0]?.id || "",
        type: "PRODUCT",
        sportType: "ALL",
        price: 15000,
        costPrice: 10000,
        unit: "cái",
        imageUrl: "",
        initialStock: 50,
        minimumStock: 5,
        description: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        await serviceApi.updateService(editingService.id, {
          name: formData.name,
          categoryId: formData.categoryId || null,
          type: formData.type,
          sportType: formData.sportType,
          price: Number(formData.price),
          costPrice: Number(formData.costPrice),
          unit: formData.unit,
          imageUrl: formData.imageUrl || null,
          minimumStock: Number(formData.minimumStock),
          description: formData.description
        });
      } else {
        await serviceApi.createService({
          name: formData.name,
          categoryId: formData.categoryId || null,
          type: formData.type,
          sportType: formData.sportType,
          price: Number(formData.price),
          costPrice: Number(formData.costPrice),
          unit: formData.unit,
          imageUrl: formData.imageUrl || null,
          initialStock: Number(formData.initialStock),
          minimumStock: Number(formData.minimumStock),
          description: formData.description
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi lưu dịch vụ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa dịch vụ này?")) return;
    try {
      await serviceApi.deleteService(id);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Lỗi xóa dịch vụ");
    }
  };

  const handleToggleStatus = async (service: ServiceItem) => {
    try {
      await serviceApi.updateService(service.id, {
        status: service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
      });
      fetchData();
    } catch (err: any) {
      alert("Lỗi đổi trạng thái");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Quản Lý Dịch Vụ & Sản Phẩm Tại Sân</h1>
          <p className="text-sm font-medium text-slate-600">
            Quản lý nước uống, đồ ăn, trái cây, bán dụng cụ và cho thuê thiết bị theo từng môn thể thao.
          </p>
        </div>
        <Button className="flex items-center gap-2 bg-[#24c866] font-bold text-[#05270e] hover:bg-[#1fa955]" onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4" /> Thêm sản phẩm / dịch vụ
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo tên sản phẩm hoặc dịch vụ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Categories Tab Pill */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory("")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              selectedCategory === ""
                ? "bg-[#02712a] text-white shadow"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                selectedCategory === c.id
                  ? "bg-[#02712a] text-white shadow"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl bg-white shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#24c866] border-t-transparent" />
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <Box className="h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-lg font-bold text-slate-700">Chưa có sản phẩm hoặc dịch vụ nào</h3>
          <p className="mt-1 text-sm text-slate-500">Tạo dịch vụ đầu tiên để phục vụ khách hàng tại sân.</p>
          <Button className="mt-4 bg-[#02712a] text-white" onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" /> Thêm ngay
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.id}
              className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                service.status === "INACTIVE" ? "opacity-60 border-slate-200" : "border-slate-200 hover:border-green-300"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                      service.type === "RENTAL_SERVICE"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {service.type === "RENTAL_SERVICE" ? "Cho thuê" : "Bán sản phẩm"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      service.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {service.status === "ACTIVE" ? "Đang bán" : "Tạm ngưng"}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 font-black text-xl">
                    {service.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-[#02712a] transition">{service.name}</h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {service.category?.name || "Khác"} • {service.sportType || "Tất cả sân"}
                    </p>
                  </div>
                </div>

                {service.description && (
                  <p className="mt-2.5 text-xs text-slate-600 line-clamp-2">{service.description}</p>
                )}

                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Giá bán:</span>
                    <span className="font-extrabold text-[#02712a] text-base">{formatMoney(service.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Giá vốn nhập:</span>
                    <span className="font-semibold text-slate-700">{formatMoney(service.costPrice)}</span>
                  </div>
                  {service.type === "PRODUCT" && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Tồn kho hiện tại:</span>
                      <span
                        className={`font-bold ${
                          (service.inventory?.quantity || 0) <= (service.inventory?.minimumStock || 5)
                            ? "text-rose-600"
                            : "text-slate-800"
                        }`}
                      >
                        {service.inventory?.quantity ?? 0} {service.unit}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleToggleStatus(service)}
                  title={service.status === "ACTIVE" ? "Ngừng kinh doanh" : "Kinh doanh lại"}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {service.status === "ACTIVE" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleOpenModal(service)}
                  title="Chỉnh sửa"
                  className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(service.id)}
                  title="Xóa"
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Service */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingService ? "Chỉnh Sửa Dịch Vụ / Sản Phẩm" : "Thêm Dịch Vụ / Sản Phẩm Mới"}
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Tên sản phẩm / dịch vụ (*)</label>
            <Input
              required
              placeholder="VD: Coca Cola 330ml, Thuê vợt cầu lông Yonex..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Loại (*)</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="PRODUCT">Sản phẩm (Đồ ăn, Thức uống, Vớ...)</option>
                <option value="RENTAL_SERVICE">Dịch vụ cho thuê (Vợt...)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Danh mục (*)</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Môn thể thao áp dụng</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold focus:border-green-600 focus:outline-none"
                value={formData.sportType}
                onChange={(e) => setFormData({ ...formData, sportType: e.target.value })}
              >
                <option value="ALL">Tất cả các môn</option>
                <option value="TENNIS">Tennis</option>
                <option value="BADMINTON">Cầu lông</option>
                <option value="PICKLEBALL">Pickleball</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Đơn vị tính</label>
              <Input
                placeholder="lon, chai, cái, quả, lượt..."
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Giá bán (VNĐ) (*)</label>
              <Input
                type="number"
                required
                min={0}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Giá nhập/vốn (VNĐ)</label>
              <Input
                type="number"
                min={0}
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
              />
            </div>
          </div>

          {!editingService && formData.type === "PRODUCT" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng nhập ban đầu</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.initialStock}
                  onChange={(e) => setFormData({ ...formData, initialStock: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mức tồn kho tối thiểu</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.minimumStock}
                  onChange={(e) => setFormData({ ...formData, minimumStock: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Mô tả chi tiết</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-green-600 focus:outline-none"
              placeholder="Mô tả sản phẩm/dịch vụ..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="bg-[#02712a] text-white">
              {editingService ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
