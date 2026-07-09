import { useSearchParams } from "react-router-dom";

export type SortOrder = "asc" | "desc";
export type UrlSortDefault<F extends string> = { field: F; order: SortOrder } | null;

/**
 * URL-persisted 3-click sort cycle (asc -> desc -> default) shared by admin list tables.
 * `paramPrefix` namespaces the sortBy/sortOrder query params for pages with multiple
 * independent tables (e.g. AdminFinancePage's reconciliation/transactions/refunds tabs).
 */
export function useUrlSort<F extends string>({
  fields,
  default: defaultSort,
  paramPrefix
}: {
  fields: readonly F[];
  default: UrlSortDefault<F>;
  paramPrefix?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const byParam = paramPrefix ? `${paramPrefix}SortBy` : "sortBy";
  const orderParam = paramPrefix ? `${paramPrefix}SortOrder` : "sortOrder";

  const urlSortBy = searchParams.get(byParam);
  const urlSortOrder = searchParams.get(orderParam);
  const activeField: F | null = fields.includes(urlSortBy as F) ? (urlSortBy as F) : null;
  const activeOrder: SortOrder | null = urlSortOrder === "asc" || urlSortOrder === "desc" ? urlSortOrder : null;
  const hasExplicitSort = Boolean(activeField && activeOrder);

  const sortField: F | null = hasExplicitSort ? activeField : (defaultSort?.field ?? null);
  const sortOrder: SortOrder = hasExplicitSort ? (activeOrder as SortOrder) : (defaultSort?.order ?? "desc");

  const handleSort = (field: F) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (activeField !== field) {
          next.set(byParam, field);
          next.set(orderParam, "asc");
        } else if (activeOrder === "asc") {
          next.set(byParam, field);
          next.set(orderParam, "desc");
        } else {
          next.delete(byParam);
          next.delete(orderParam);
        }
        return next;
      },
      { replace: true }
    );
  };

  return { sortField, sortOrder, activeField, handleSort };
}
