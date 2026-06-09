import { useEffect, useState, type PropsWithChildren } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import clsx from "clsx";

export function SectionShell({ eyebrow, title, description, children, className }: PropsWithChildren<{ eyebrow?: string; title: string; description?: string; className?: string }>) {
  return (
    <section className={clsx("relative overflow-hidden py-16 md:py-24", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mb-9 max-w-3xl">
          {eyebrow && <p className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-[#0f766e]">{eyebrow}</p>}
          <h2 className="text-3xl font-black tracking-tight text-[#08111f] md:text-5xl">{title}</h2>
          {description && <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{description}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

export function Reveal({ children, className, delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function CountUp({ value, suffix = "+" }: { value: number; suffix?: string }) {
  const raw = useMotionValue(0);
  const spring = useSpring(raw, { stiffness: 80, damping: 18 });
  const display = useTransform(spring, (latest) => `${Math.round(latest).toLocaleString("vi-VN")}${suffix}`);
  const [text, setText] = useState("0");

  useEffect(() => {
    const unsubscribe = display.on("change", setText);
    raw.set(value);
    return unsubscribe;
  }, [display, raw, value]);

  return <span>{text}</span>;
}

export function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/70 bg-white p-3 shadow-sm">
      <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function Pill({ children, tone = "dark" }: PropsWithChildren<{ tone?: "dark" | "green" | "blue" | "amber" }>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em]",
        tone === "dark" && "bg-[#0b1220] text-white",
        tone === "green" && "bg-emerald-100 text-emerald-800",
        tone === "blue" && "bg-blue-100 text-blue-800",
        tone === "amber" && "bg-amber-100 text-amber-800"
      )}
    >
      {children}
    </span>
  );
}
