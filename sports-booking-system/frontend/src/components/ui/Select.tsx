import type { SelectHTMLAttributes } from "react";
import clsx from "clsx";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Array<{ value: string; label: string }>;
  dense?: boolean;
};

export function Select({ label, options, dense, className, ...props }: Props) {
  return (
    <label className={clsx("grid text-sm font-medium text-ink", dense ? "gap-1" : "gap-1.5")}>
      {label && <span className={dense ? "text-xs" : undefined}>{label}</span>}
      <select
        className={clsx(
          "rounded-md border border-line bg-white outline-none focus:border-action",
          dense ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
