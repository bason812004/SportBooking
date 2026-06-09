import { appBadges } from "./homeData";
import { Reveal } from "./homeUtils";

export function AppSection() {
  return (
    <section className="bg-[#0f766e] py-16 text-white md:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_380px] lg:items-center">
        <Reveal>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-100">Mobile app</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Ứng dụng đặt sân đang được chuẩn bị</h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50">Nhận thông báo lịch trống, check-in nhanh, tích điểm thưởng và quản lý đội chơi ngay trên điện thoại.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {appBadges.map((badge) => (
              <span key={badge.label} className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-black text-[#0f766e]">
                <badge.icon className="h-5 w-5" />
                {badge.label}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="mx-auto grid h-72 w-72 place-items-center rounded-[2rem] bg-white p-6 text-[#0f766e] shadow-2xl">
            <div className="grid h-full w-full grid-cols-7 gap-2">
              {Array.from({ length: 49 }).map((_, index) => <span key={index} className={`${index % 3 === 0 || index % 7 === 0 ? "bg-[#0f766e]" : "bg-emerald-100"} rounded`} />)}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
