import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({ children, className, variant = "primary", ...props }: PropsWithChildren<Props>) {
  return (
    <button
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-action text-white hover:bg-blue-700",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-field",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "text-ink hover:bg-field",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
