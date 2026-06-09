import { CountUp, Reveal } from "./homeUtils";

const achievements = [
  { label: "lượt đặt", value: 10000 },
  { label: "sân thể thao", value: 500 },
  { label: "người dùng", value: 50000 },
  { label: "đối tác", value: 200 }
];

export function AchievementSection() {
  return (
    <section className="bg-[#0b1220] py-16 text-white md:py-24">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-4">
        {achievements.map((item, index) => (
          <Reveal key={item.label} delay={index * 0.05}>
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-7 text-center backdrop-blur">
              <p className="text-4xl font-black md:text-5xl"><CountUp value={item.value} /></p>
              <p className="mt-2 font-semibold text-slate-300">{item.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
