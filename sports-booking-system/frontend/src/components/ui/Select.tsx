import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Array<{ value: string; label: string }>;
};

export function Select({ label, options, ...props }: Props) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      {label && <span>{label}</span>}
      <select className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
