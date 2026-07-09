import type { ReactNode } from "react";

type SortOrder = "asc" | "desc";

export function SortableTh<F extends string>({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  className
}: {
  label: ReactNode;
  field: F;
  sortField: F | null;
  sortOrder: SortOrder;
  onSort: (field: F) => void;
  className?: string;
}) {
  const isActive = field === sortField;
  const icon = isActive ? (sortOrder === "asc" ? "▲" : "▼") : "⇅";
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex cursor-pointer select-none items-center gap-1 border-0 bg-transparent p-0 text-inherit hover:text-slate-900"
      >
        <span>{label}</span>
        <span className={isActive ? "text-slate-600" : "text-slate-300"}>{icon}</span>
      </button>
    </th>
  );
}
