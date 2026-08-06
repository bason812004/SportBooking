export function StatusBadge({ value, tones, labels }: { value: string; tones: Record<string, string>; labels?: Record<string, string> }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[value] ?? "bg-slate-100 text-slate-700"}`}>
      {labels?.[value] ?? value}
    </span>
  );
}
