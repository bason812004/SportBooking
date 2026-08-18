import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  Dumbbell,
  Coffee,
  PackageCheck,
  Plus,
  Minus,
  Sparkles,
  Loader2,
  CheckCircle2,
  Milk,
  Apple,
  Shirt,
  Utensils
} from "lucide-react";
import { serviceApi, type ServiceCategory, type ServiceItem } from "../api/serviceApi";
import { formatCurrency } from "../../../lib/format";

interface BookingServiceSelectorProps {
  courtId: string;
  selectedServices: Map<string, { service: ServiceItem; quantity: number }>;
  onUpdateQuantity: (service: ServiceItem, quantity: number) => void;
  onClearServices: () => void;
}

export function BookingServiceSelector({
  courtId,
  selectedServices,
  onUpdateQuantity,
  onClearServices
}: BookingServiceSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>("ALL");

  // Fetch categories
  const categoriesQuery = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => serviceApi.getCategories(),
    staleTime: 5 * 60_000
  });

  // Fetch court services from backend (REAL DATABASE STRICTLY FOR THIS COURT)
  const servicesQuery = useQuery({
    queryKey: ["court-services", courtId],
    queryFn: () => serviceApi.getCourtServices(courtId),
    enabled: Boolean(courtId),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000
  });

  const services = servicesQuery.data ?? [];

  // Group services prioritizing Sports Equipment & Rental Items first
  const categorizedServices = useMemo(() => {
    if (!services.length) return [];

    if (activeTab === "ALL") {
      return [...services].sort((a, b) => {
        const slugA = (a.categorySlug || a.category?.slug || "").toLowerCase();
        const slugB = (b.categorySlug || b.category?.slug || "").toLowerCase();
        const isEquipmentA = slugA.includes("dung-cu") || slugA.includes("thue");
        const isEquipmentB = slugB.includes("dung-cu") || slugB.includes("thue");
        if (isEquipmentA && !isEquipmentB) return -1;
        if (!isEquipmentA && isEquipmentB) return 1;
        return 0;
      });
    }

    return services.filter((s) => {
      const slug = (s.categorySlug || s.category?.slug || "").toLowerCase();
      const catId = s.categoryId || s.category?.id;
      if (activeTab === "EQUIPMENT") return slug.includes("dung-cu") || slug.includes("thue");
      if (activeTab === "FOOD_DRINK") return slug.includes("do-uong") || slug.includes("do-an") || slug.includes("trai-cay");
      if (activeTab === "COMBO") return slug.includes("combo");
      return catId === activeTab || slug === activeTab;
    });
  }, [services, activeTab]);

  const totalSelectedCount = useMemo(() => {
    let count = 0;
    selectedServices.forEach((item) => {
      count += item.quantity;
    });
    return count;
  }, [selectedServices]);

  const totalServicesPrice = useMemo(() => {
    let sum = 0;
    selectedServices.forEach((item) => {
      sum += item.service.price * item.quantity;
    });
    return sum;
  }, [selectedServices]);

  function getIconForCategory(slug?: string) {
    const s = (slug || "").toLowerCase();
    if (s.includes("thue") || s.includes("dung-cu")) return <Dumbbell className="h-3.5 w-3.5 text-emerald-600" />;
    if (s.includes("do-uong")) return <Milk className="h-3.5 w-3.5 text-sky-600" />;
    if (s.includes("trai-cay")) return <Apple className="h-3.5 w-3.5 text-rose-500" />;
    if (s.includes("do-an")) return <Utensils className="h-3.5 w-3.5 text-amber-600" />;
    return <Sparkles className="h-3.5 w-3.5 text-emerald-600" />;
  }

  return (
    <div className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#02712a]" />
            Dịch Vụ & Dụng Cụ Phục Vụ Tại Sân
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Dịch vụ thật được quản lý kho từ chủ sân · Thuê vợt, bóng, nước uống & đồ ăn chuẩn bị sẵn tại sân
          </p>
        </div>

        {totalSelectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-[#02712a] flex items-center gap-1 border border-emerald-200 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {totalSelectedCount} món (+{formatCurrency(totalServicesPrice)})
            </span>
            <button
              type="button"
              onClick={onClearServices}
              className="text-xs font-bold text-slate-400 hover:text-rose-600 transition"
            >
              Xóa chọn
            </button>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${
            activeTab === "ALL"
              ? "bg-[#02712a] text-white border-[#02712a] shadow-md scale-[1.02]"
              : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/60"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Tất cả ({services.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("EQUIPMENT")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${
            activeTab === "EQUIPMENT"
              ? "bg-[#02712a] text-white border-[#02712a] shadow-md scale-[1.02]"
              : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/60"
          }`}
        >
          <Dumbbell className="h-3.5 w-3.5 text-emerald-600" />
          Dụng cụ thể thao
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FOOD_DRINK")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${
            activeTab === "FOOD_DRINK"
              ? "bg-[#02712a] text-white border-[#02712a] shadow-md scale-[1.02]"
              : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/60"
          }`}
        >
          <Coffee className="h-3.5 w-3.5 text-amber-600" />
          Đồ ăn & Nước uống
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMBO")}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition border ${
            activeTab === "COMBO"
              ? "bg-[#02712a] text-white border-[#02712a] shadow-md scale-[1.02]"
              : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/60"
          }`}
        >
          <PackageCheck className="h-3.5 w-3.5 text-blue-600" />
          Combo Tiết Kiệm
        </button>
      </div>

      {/* Services Grid */}
      {servicesQuery.isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 gap-2 font-semibold text-xs">
          <Loader2 className="h-5 w-5 animate-spin text-[#02712a]" />
          Đang kết nối kho hàng cơ sở dữ liệu sân...
        </div>
      ) : categorizedServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs font-semibold">
          Chưa có dịch vụ nào thuộc danh mục này tại sân.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categorizedServices.map((service) => {
            const currentItem = selectedServices.get(service.id);
            const qty = currentItem?.quantity ?? 0;

            const stock = service.inventory?.quantity ?? 50;
            const isOutOfStock = stock <= 0;
            const catSlug = service.categorySlug || service.category?.slug;
            const catName = service.categoryName || service.category?.name || "Dịch vụ";

            return (
              <div
                key={service.id}
                className={`rounded-2xl border p-3.5 transition-all flex flex-col justify-between relative ${
                  qty > 0
                    ? "border-[#02712a] bg-emerald-50/40 ring-2 ring-[#02712a]/20 shadow-md"
                    : isOutOfStock
                    ? "border-slate-200 bg-slate-50/70 opacity-60"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/70 px-2 py-0.5 text-[10px] font-black text-[#02712a]">
                      {getIconForCategory(catSlug)}
                      {catName}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isOutOfStock
                          ? "bg-rose-100 text-rose-700"
                          : stock <= 5
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isOutOfStock ? "HẾT HÀNG" : `Còn ${stock} ${service.unit}`}
                    </span>
                  </div>

                  <h4 className="mt-2 font-black text-slate-900 text-xs leading-snug line-clamp-1">{service.name}</h4>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div>
                    <span className="text-sm font-black text-[#02712a]">{formatCurrency(service.price)}</span>
                    <span className="text-[10px] font-semibold text-slate-400"> / {service.unit}</span>
                  </div>

                  {/* Quantity Counter Buttons */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      disabled={qty <= 0}
                      onClick={() => onUpdateQuantity(service, qty - 1)}
                      className="h-6 w-6 rounded-md bg-white shadow-sm flex items-center justify-center text-slate-700 font-black disabled:opacity-30 hover:bg-slate-200 transition"
                    >
                      <Minus className="h-3 w-3" />
                    </button>

                    <span className="w-5 text-center text-xs font-black text-slate-900">{qty}</span>

                    <button
                      type="button"
                      disabled={isOutOfStock || qty >= stock}
                      onClick={() => onUpdateQuantity(service, qty + 1)}
                      className="h-6 w-6 rounded-md bg-[#02712a] text-white shadow-sm flex items-center justify-center font-black disabled:opacity-30 hover:bg-[#025c22] transition"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
