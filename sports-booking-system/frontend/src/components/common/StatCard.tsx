import type { ComponentType } from "react";
import { Link } from "react-router-dom";

export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  tone,
  to,
  footnote
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  tone?: string;
  to?: string;
  footnote?: string;
}) {
  const card = (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${to ? "transition hover:shadow-md hover:border-emerald-300" : ""}`}>
      <div className="flex justify-between">
        <p className="font-medium text-slate-600">{label}</p>
        <span className={`rounded-xl p-2 ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className={`mt-3 text-2xl font-black ${tone ?? "text-slate-800"}`}>{value}</p>
      {footnote && <p className="mt-1 text-xs text-slate-500">{footnote}</p>}
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}
