import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Loader2,
  Check,
  AlertCircle,
  Coffee,
  Package,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { bookingApi, type AvailableService } from "../api/bookingApi";
import { formatCurrency } from "../../../lib/format";

interface BookingServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  courtId?: string;
  courtName?: string;
  onSuccess?: () => void;
}

export function BookingServiceModal({
  isOpen,
  onClose,
  bookingId,
  courtId,
  courtName,
  onSuccess
}: BookingServiceModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingServiceId, setAddingServiceId] = useState<string | null>(null);

  // Fetch available services for the court / venue
  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ["available-services", courtId],
    queryFn: () => bookingApi.listAvailableServices({ courtId }),
    enabled: isOpen
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.categoryName) set.add(s.categoryName);
      else if (s.type) set.add(s.type);
    });
    return ["ALL", ...Array.from(set)];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        !searchQuery ||
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === "ALL" ||
        service.categoryName === selectedCategory ||
        service.type === selectedCategory;

      return matchesSearch && matchesCat && service.status !== "INACTIVE";
    });
  }, [services, searchQuery, selectedCategory]);

  const addServiceMutation = useMutation({
    mutationFn: async ({ serviceId, quantity }: { serviceId: string; quantity: number }) => {
      return bookingApi.addService(bookingId, { serviceId, quantity });
    },
    onSuccess: (_data, variables) => {
      const item = services.find((s) => s.id === variables.serviceId);
      toast.success(`Đã thêm ${variables.quantity}x ${item?.name || "dịch vụ"} vào bill.`);
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-bill", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["available-services"] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || "Không thể thêm dịch vụ");
    },
    onSettled: () => {
      setAddingServiceId(null);
    }
  });

  if (!isOpen) return null;

  const handleQuantityChange = (serviceId: string, delta: number, maxStock?: number) => {
    setQuantities((prev) => {
      const current = prev[serviceId] || 1;
      const next = current + delta;
      if (next < 1) return prev;
      if (maxStock !== undefined && maxStock > 0 && next > maxStock) {
        toast.info(`Chỉ còn ${maxStock} sản phẩm trong kho`);
        return prev;
      }
      return { ...prev, [serviceId]: next };
    });
  };

  const handleAdd = (service: AvailableService) => {
    const qty = quantities[service.id] || 1;
    setAddingServiceId(service.id);
    addServiceMutation.mutate({ serviceId: service.id, quantity: qty });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Mua thêm dịch vụ & đồ ăn nước uống</h2>
              <p className="text-xs text-slate-500">
                {courtName ? `Sân: ${courtName} · ` : ""}Cộng trực tiếp vào bill đơn đặt sân
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="border-b border-slate-100 p-4 space-y-3 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm nước khoáng, nước tăng lực, bóng tenis, cầu lông..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedCategory === cat
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-700/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat === "ALL" ? "Tất cả" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Services List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-semibold text-slate-500">Đang tải danh mục dịch vụ...</p>
            </div>
          ) : isError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-rose-500">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-bold">Không thể tải danh sách dịch vụ</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <Package className="h-10 w-10 stroke-1" />
              <p className="text-sm font-medium">Không tìm thấy dịch vụ hoặc món phù hợp.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredServices.map((service) => {
                const stock = service.inventoryQuantity ?? service.stock ?? 50;
                const isOutOfStock = service.trackInventory && stock <= 0;
                const qty = quantities[service.id] || 1;
                const isAdding = addingServiceId === service.id;

                return (
                  <div
                    key={service.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                  >
                    <div className="flex gap-3">
                      {/* Image Thumbnail */}
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-100">
                        {service.imageUrl ? (
                          <img
                            src={service.imageUrl}
                            alt={service.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              // Fallback to placeholder gradient if image broken
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-emerald-50 text-emerald-700">
                            {service.type === "RENTAL" ? (
                              <Layers className="h-7 w-7" />
                            ) : (
                              <Coffee className="h-7 w-7" />
                            )}
                          </div>
                        )}
                        {service.type === "RENTAL" && (
                          <span className="absolute bottom-1 left-1 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-black text-white">
                            Thuê
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 line-clamp-1">{service.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">{service.description || service.unit}</p>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-base font-black text-emerald-700">
                            {formatCurrency(Number(service.price))}
                          </span>
                          <span className="text-[11px] text-slate-400">/{service.unit || "cái"}</span>
                        </div>

                        {/* Stock badge */}
                        <div className="mt-1">
                          {isOutOfStock ? (
                            <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">
                              Hết hàng
                            </span>
                          ) : service.trackInventory ? (
                            <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Còn {stock} {service.unit}
                            </span>
                          ) : (
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              Có sẵn
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      {/* Counter */}
                      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(service.id, -1, stock)}
                          disabled={qty <= 1 || isOutOfStock}
                          className="grid h-6 w-6 place-items-center rounded-lg bg-white text-slate-600 shadow-sm hover:bg-slate-100 disabled:opacity-40 transition"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-black text-slate-800">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(service.id, 1, stock)}
                          disabled={isOutOfStock || (service.trackInventory && qty >= stock)}
                          className="grid h-6 w-6 place-items-center rounded-lg bg-white text-slate-600 shadow-sm hover:bg-slate-100 disabled:opacity-40 transition"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Add Button */}
                      <button
                        type="button"
                        onClick={() => handleAdd(service)}
                        disabled={isOutOfStock || isAdding}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-sm shadow-emerald-700/20 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Đang thêm...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            <span>Thêm vào bill</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            Dịch vụ được cập nhật vào bill ngay lập tức và đồng bộ với thu ngân sân.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
