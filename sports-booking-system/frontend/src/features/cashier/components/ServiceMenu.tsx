import { Lock, Package, Plus, Search } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { ServiceImage } from "../../../components/common/ServiceImage";
import { formatMoney } from "../../../utils/formatters";
import type { ServiceCategory, ServiceItem } from "../../services/api/serviceApi";

/**
 * The court's menu (food, drinks, gear to rent) for adding to the selected session. `blockedReason` greys it out
 * with the reason: no session picked, or the session has ended.
 */
export function ServiceMenu({
  courtLabel,
  services,
  categories,
  category,
  onCategory,
  search,
  onSearch,
  blockedReason,
  onAdd
}: {
  courtLabel: string | null;
  services: ServiceItem[];
  categories: ServiceCategory[];
  category: string;
  onCategory: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  blockedReason: string | null;
  onAdd: (service: ServiceItem) => void;
}) {
  const chip = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${active ? "bg-[#02712a] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-slate-100 p-3.5">
        <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-900">
          <Package className="h-4 w-4 shrink-0 text-[#02712a]" /> Thêm dịch vụ
          {courtLabel && (
            <span className="truncate rounded-lg border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-[#02712a]">
              {courtLabel}
            </span>
          )}
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm món, nước, đồ thuê..." value={search} onChange={(event) => onSearch(event.target.value)} className="h-9 rounded-xl py-2 pl-8 text-xs" />
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => onCategory("")} className={chip(category === "")}>Tất cả</button>
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => onCategory(item.id)} className={chip(category === item.id)}>
              {item.name}
            </button>
          ))}
        </div>
        {blockedReason && (
          <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <Lock className="h-3.5 w-3.5 shrink-0" /> {blockedReason}
          </p>
        )}
      </div>

      <div className="max-h-[28rem] min-h-0 flex-1 overflow-y-auto p-3 lg:max-h-none">
        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            {courtLabel ? "Không tìm thấy món hoặc dịch vụ phù hợp." : "Chọn một phiên sân để xem menu của sân đó."}
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
            {services.map((service) => {
              const stock = service.trackInventory ? Number(service.inventory?.quantity ?? 0) : Infinity;
              const outOfStock = service.trackInventory && stock <= 0;
              const disabled = Boolean(blockedReason) || outOfStock;
              return (
                <button
                  key={service.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(service)}
                  className={`group flex select-none flex-col justify-between rounded-2xl border p-3 text-left transition ${
                    disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-50/80 opacity-60"
                      : "border-slate-200 bg-white hover:border-[#02712a] hover:shadow-md active:scale-[0.98]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                      {service.type === "RENTAL_SERVICE" ? "Cho thuê" : service.unit}
                    </span>
                    {service.trackInventory && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                          outOfStock ? "bg-rose-100 text-rose-700" : stock <= 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {outOfStock ? "Hết hàng" : `Kho: ${stock}`}
                      </span>
                    )}
                  </span>
                  {/* ServiceImage fits the picture inside the box, so wide product shots are not cropped. */}
                  <span className="mt-2 flex items-center gap-2">
                    <ServiceImage
                      src={service.imageUrl}
                      alt={service.name}
                      className="h-10 w-10 shrink-0 rounded-xl"
                      fallback={
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                          <Package className="h-5 w-5" />
                        </span>
                      }
                    />
                    <span className="line-clamp-2 text-xs font-black text-slate-900 group-hover:text-[#02712a]">{service.name}</span>
                  </span>
                  <span className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-xs font-black text-[#02712a]">{formatMoney(service.price)}</span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        disabled ? "bg-slate-200 text-slate-400" : "bg-green-50 text-[#02712a] group-hover:bg-[#02712a] group-hover:text-white"
                      }`}
                    >
                      {blockedReason ? <Lock className="h-3 w-3" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
