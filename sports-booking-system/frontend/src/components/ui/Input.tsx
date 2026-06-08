import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: Props) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      {label && <span>{label}</span>}
      <input
        className={clsx("h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action", className)}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
