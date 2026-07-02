import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Check, ChevronDown, Clock3, MapPin, Search, SlidersHorizontal, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useSportTypes } from "../../../features/courts/hooks/useCourts";
import { heroSlides, trustStats } from "./homeData";
import { CountUp, Reveal } from "./homeUtils";

type PickerName = "location" | "sport" | "time" | "price" | null;
type Option = { value: string; label: string; hint?: string };

const locationSuggestions: Option[] = [
  { label: "Thành phố Hồ Chí Minh", value: "Hồ Chí Minh", hint: "Quận 1, Thủ Đức, Phú Nhuận" },
  { label: "Thành phố Hà Nội", value: "Hà Nội", hint: "Cầu Giấy, Mỹ Đình, Thanh Xuân" },
  { label: "Thành phố Đà Nẵng", value: "Đà Nẵng", hint: "Hải Châu, Sơn Trà, Ngũ Hành Sơn" },
  { label: "Thành phố Thủ Đức", value: "Thủ Đức", hint: "Riverside, Sala, Linh Trung" },
  { label: "Quận Phú Nhuận", value: "Phú Nhuận", hint: "Cầu lông, bóng đá, tennis" },
  { label: "Quận Gò Vấp", value: "Gò Vấp", hint: "Cầu lông, pickleball" }
];

const timeOptions: Option[] = [
  { value: "06:00-09:00", label: "06:00 - 09:00", hint: "Buổi sáng" },
  { value: "09:00-12:00", label: "09:00 - 12:00", hint: "Giờ nhẹ" },
  { value: "14:00-17:00", label: "14:00 - 17:00", hint: "Buổi chiều" },
  { value: "18:00-22:00", label: "18:00 - 22:00", hint: "Giờ vàng" }
];

const priceOptions: Option[] = [
  { value: "", label: "Mọi mức giá", hint: "Không giới hạn" },
  { value: "0-150000", label: "Dưới 150k", hint: "Tiết kiệm" },
  { value: "150000-300000", label: "150k - 300k", hint: "Phổ biến" },
  { value: "300000-500000", label: "300k - 500k", hint: "Sân tốt" },
  { value: "500000-", label: "Trên 500k", hint: "Cao cấp" }
];

export function HeroSection() {
  const navigate = useNavigate();
  const sportTypes = useSportTypes();
  const [openPicker, setOpenPicker] = useState<PickerName>(null);
  const [district, setDistrict] = useState("");
  const [sportType, setSportType] = useState("");
  const [date, setDate] = useState("");
  const [timeRange, setTimeRange] = useState("18:00-22:00");
  const [priceRange, setPriceRange] = useState("100000-500000");

  const sportOptions = useMemo<Option[]>(() => {
    const fromApi = (sportTypes.data ?? []).map((item) => ({ value: item.value, label: item.label, hint: "Sân đang mở đặt" }));
    return [{ value: "", label: "Tất cả loại sân", hint: "Bóng đá, cầu lông, tennis..." }, ...fromApi];
  }, [sportTypes.data]);

  const selectedSport = sportOptions.find((item) => item.value === sportType) ?? sportOptions[0];
  const selectedTime = timeOptions.find((item) => item.value === timeRange) ?? timeOptions[3];
  const selectedPrice = priceOptions.find((item) => item.value === priceRange) ?? { value: "100000-500000", label: "100k - 500k", hint: "Khoảng giá đề xuất" };

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (district.trim()) params.set("district", district.trim());
    if (sportType) params.set("sportType", sportType);
    if (date) params.set("date", date);
    if (timeRange) params.set("timeRange", timeRange);
    if (priceRange) {
      const [minPrice, maxPrice] = priceRange.split("-");
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
    }
    navigate(`/courts${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const panel =
    openPicker === "location" ? (
      <ChoicePanel title="Gợi ý địa điểm">
        {locationSuggestions.map((item) => (
          <OptionButton key={item.value} active={district === item.value} item={item} onClick={() => { setDistrict(item.value); setOpenPicker(null); }} />
        ))}
      </ChoicePanel>
    ) : openPicker === "sport" ? (
      <ChoicePanel title="Chọn loại sân">
        {sportOptions.map((item) => (
          <OptionButton key={item.value} active={sportType === item.value} item={item} onClick={() => { setSportType(item.value); setOpenPicker(null); }} />
        ))}
      </ChoicePanel>
    ) : openPicker === "time" ? (
      <ChoicePanel title="Chọn khung giờ">
        {timeOptions.map((item) => (
          <OptionButton key={item.value} active={timeRange === item.value} item={item} onClick={() => { setTimeRange(item.value); setOpenPicker(null); }} />
        ))}
      </ChoicePanel>
    ) : openPicker === "price" ? (
      <ChoicePanel title="Chọn khoảng giá">
        {priceOptions.map((item) => (
          <OptionButton key={item.value} active={priceRange === item.value} item={item} onClick={() => { setPriceRange(item.value); setOpenPicker(null); }} />
        ))}
      </ChoicePanel>
    ) : null;

  return (
    <section className="relative min-h-[calc(100vh-80px)] overflow-hidden bg-[#07111f] text-white">
      <div className="absolute inset-0">
        {heroSlides.map((image, index) => (
          <motion.img
            key={image}
            src={image}
            alt="Sân thể thao chuyên nghiệp"
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: index === 0 ? 1 : 0, scale: 1.08 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [1.08, 1.02, 1.02, 1.08] }}
            transition={{ duration: 14, repeat: Infinity, delay: index * 4.6, ease: "easeInOut" }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,0.28),transparent_34%),linear-gradient(120deg,rgba(7,17,31,0.94),rgba(7,17,31,0.68)_48%,rgba(7,17,31,0.36))]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6">
        <Reveal className="max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
            <Trophy className="h-4 w-4 text-emerald-300" />
            Nền tảng đặt sân thể thao thế hệ mới
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.98] md:text-7xl lg:text-8xl">
            Đặt sân thể thao dễ dàng chỉ trong vài giây
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 md:text-xl">
            So sánh giá, kiểm tra lịch trống realtime, nhận ưu đãi và giữ chỗ tại các sân uy tín gần bạn.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10 rounded-[2rem] border border-white/20 bg-white/95 p-3 text-[#0b1220] shadow-2xl shadow-black/30 backdrop-blur md:p-4">
          <form onSubmit={submitSearch} className="grid gap-3 md:grid-cols-[1.25fr_1fr_1fr_1fr_1fr_auto]">
            <SearchField icon={MapPin} label="Địa điểm">
              <input
                value={district}
                onFocus={() => setOpenPicker("location")}
                onChange={(event) => {
                  setDistrict(event.target.value);
                  setOpenPicker("location");
                }}
                placeholder="Chọn thành phố, quận..."
                className="mt-1 w-full bg-transparent font-bold outline-none placeholder:text-slate-400"
              />
            </SearchField>

            <PickerField icon={Trophy} label="Loại sân" value={selectedSport.label} open={openPicker === "sport"} onToggle={() => setOpenPicker(openPicker === "sport" ? null : "sport")} />

            <SearchField icon={CalendarDays} label="Ngày">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full bg-transparent font-bold outline-none" />
            </SearchField>

            <PickerField icon={Clock3} label="Khung giờ" value={selectedTime.label} open={openPicker === "time"} onToggle={() => setOpenPicker(openPicker === "time" ? null : "time")} />
            <PickerField icon={SlidersHorizontal} label="Khoảng giá" value={selectedPrice.label} open={openPicker === "price"} onToggle={() => setOpenPicker(openPicker === "price" ? null : "price")} />

            <button type="submit" className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-6 font-black text-white shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:bg-[#115e59] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
              <Search className="h-5 w-5" />
              Tìm sân ngay
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2 px-1">
            {locationSuggestions.slice(0, 4).map((item) => (
              <button key={item.value} type="button" onClick={() => setDistrict(item.value)} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100">
                {item.label}
              </button>
            ))}
          </div>

          {panel}
        </Reveal>

        <Reveal delay={0.22} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trustStats.map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-3xl font-black"><CountUp value={item.value} /></p>
              <p className="mt-1 text-sm text-slate-200">{item.label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function SearchField({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left transition focus-within:border-[#0f766e] focus-within:shadow-md">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#0f766e]"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase text-slate-400">{label}</span>
        {children}
      </span>
    </div>
  );
}

function PickerField({ icon: Icon, label, value, open, onToggle }: { icon: typeof MapPin; label: string; value: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-white px-4 text-left transition ${open ? "border-[#0f766e] shadow-md" : "border-slate-200 hover:border-[#0f766e]"}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#0f766e]"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase text-slate-400">{label}</span>
        <span className="mt-1 block truncate font-bold">{value}</span>
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

function ChoicePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-inner">
      <div className="px-2 pb-2 text-xs font-black uppercase text-slate-400">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </motion.div>
  );
}

function OptionButton({ active, item, onClick }: { active: boolean; item: Option; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-16 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
        {active ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-black">{item.label}</span>
        {item.hint && <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{item.hint}</span>}
      </span>
    </button>
  );
}
