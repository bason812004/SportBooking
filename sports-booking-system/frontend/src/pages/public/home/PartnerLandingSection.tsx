import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, LineChart, Settings2 } from "lucide-react";
import { Reveal } from "./homeUtils";

export function PartnerLandingSection() {
  return (
    <section className="relative overflow-hidden bg-[#ecfdf5] py-16 md:py-24">
      <div className="absolute -right-32 top-10 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <Reveal>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-[#0f766e]">Dành cho chủ sân</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Tăng doanh thu và tự động hóa vận hành sân</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Nhận booking mới, quản lý lịch trống, giá theo khung giờ và báo cáo doanh thu trong một bảng điều khiển.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Benefit icon={LineChart} title="+32% doanh thu" />
            <Benefit icon={CalendarClock} title="Lịch tự động" />
            <Benefit icon={Settings2} title="Quản lý đa sân" />
          </div>
          <Link to="/register-partner" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#0f766e] px-6 py-4 font-black text-white shadow-xl shadow-emerald-900/20">
            Đăng ký đối tác <ArrowRight className="h-5 w-5" />
          </Link>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="rounded-[2.5rem] border border-emerald-200 bg-white p-5 shadow-2xl">
            <div className="rounded-[2rem] bg-[#0b1220] p-6 text-white">
              <p className="text-sm text-slate-300">Doanh thu tháng này</p>
              <p className="mt-2 text-5xl font-black">128.4M</p>
              <div className="mt-8 h-44 rounded-2xl bg-[linear-gradient(135deg,#10b981,#2563eb)] p-5">
                <div className="flex h-full items-end gap-3">
                  {[44, 70, 52, 90, 76, 112, 96].map((height, index) => <span key={index} className="flex-1 rounded-t-lg bg-white/75" style={{ height }} />)}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Benefit({ icon: Icon, title }: { icon: typeof LineChart; title: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-[#0f766e]" />
      <p className="mt-3 font-black">{title}</p>
    </div>
  );
}
