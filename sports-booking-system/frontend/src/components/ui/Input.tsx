import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  dense?: boolean;
};

export function Input({ label, error, className, dense, ...props }: Props) {
  return (
    <label className={clsx("grid text-sm font-medium text-ink", dense ? "gap-1" : "gap-1.5")}>
      {label && <span className={dense ? "text-xs" : undefined}>{label}</span>}
      <input
        className={clsx(
          "rounded-md border border-line bg-white outline-none focus:border-action",
          dense ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
