import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({ children, className, variant = "primary", size = "md", ...props }: PropsWithChildren<Props>) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        variant === "primary" && "bg-action text-white hover:bg-emerald-700",
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
