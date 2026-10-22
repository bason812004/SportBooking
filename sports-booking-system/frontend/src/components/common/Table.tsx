import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import clsx from "clsx";

export function Table({ className, minWidth, children, ...props }: HTMLAttributes<HTMLTableElement> & { minWidth?: string }) {
  return (
    <div className="overflow-auto rounded-2xl border border-line bg-white">
      <table className={clsx("w-full text-sm", className)} style={minWidth ? { minWidth } : undefined} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={clsx("bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)} {...props}>
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={clsx("divide-y divide-slate-100", className)} {...props}>
      {children}
    </tbody>
  );
}

export function Tr({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={clsx("transition-colors odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/60", className)} {...props}>
      {children}
    </tr>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={clsx("p-3 first:pl-4 last:pr-4", className)} {...props}>
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={clsx("p-3 align-top first:pl-4 last:pr-4", className)} {...props}>
      {children}
    </td>
  );
}
