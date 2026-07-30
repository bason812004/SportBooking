import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  children
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-4 text-white shadow-xl">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-black">
            {title}
            {eyebrow && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
                {eyebrow}
              </span>
            )}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="relative mt-4 flex flex-wrap justify-start">{children}</div>}
    </section>
  );
}
