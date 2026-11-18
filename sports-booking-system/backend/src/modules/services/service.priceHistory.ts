/**
 * Service price history: each time a service's sale price or cost price is set, when, from what to what and by whom
 * (table `service_price_history`, append-only).
 *   INITIAL  the price the service had when recording started (database/39_service_price_history.sql); its time is
 *            that moment, not when the price was really set
 *   CREATED  the price the service was created with
 *   CHANGED  a later change of the sale price, the cost price or both
 */
export const PRICE_HISTORY_KINDS = ["INITIAL", "CREATED", "CHANGED"] as const;
export type PriceHistoryKind = (typeof PRICE_HISTORY_KINDS)[number];

/** A money value as the database driver hands it over (Prisma Decimal, string or number). */
type Money = number | string | { toString(): string } | null | undefined;

export type ServicePrices = { price: Money; costPrice: Money };

const cents = (value: Money) => Math.round(Number(value == null ? 0 : value.toString()) * 100);
const money = (value: Money) => (value == null ? null : cents(value) / 100);

/** Whether the sale price or the cost price is different, to the đồng (a Decimal and a number compare alike). */
export function pricesChanged(before: ServicePrices, after: ServicePrices) {
  return cents(before.price) !== cents(after.price) || cents(before.costPrice) !== cents(after.costPrice);
}

export type PriceHistoryRow = {
  id: string;
  kind: string;
  oldPrice: Money;
  newPrice: Money;
  oldCostPrice: Money;
  newCostPrice: Money;
  changedAt: Date | string;
  changedById: string | null;
  changedByName: string | null;
};

export type PriceHistoryEntry = {
  id: string;
  kind: PriceHistoryKind;
  oldPrice: number | null;
  newPrice: number;
  oldCostPrice: number | null;
  newCostPrice: number;
  /** Which of the two prices this change moved (both false for INITIAL and CREATED). */
  priceChanged: boolean;
  costPriceChanged: boolean;
  changedAt: string;
  changedBy: { id: string; fullName: string } | null;
};

export function toPriceHistoryEntry(row: PriceHistoryRow): PriceHistoryEntry {
  const kind = (PRICE_HISTORY_KINDS as readonly string[]).includes(row.kind) ? (row.kind as PriceHistoryKind) : "CHANGED";
  const oldPrice = money(row.oldPrice);
  const oldCostPrice = money(row.oldCostPrice);
  const newPrice = money(row.newPrice) ?? 0;
  const newCostPrice = money(row.newCostPrice) ?? 0;
  return {
    id: row.id,
    kind,
    oldPrice,
    newPrice,
    oldCostPrice,
    newCostPrice,
    priceChanged: kind === "CHANGED" && oldPrice !== null && oldPrice !== newPrice,
    costPriceChanged: kind === "CHANGED" && oldCostPrice !== null && oldCostPrice !== newCostPrice,
    changedAt: new Date(row.changedAt).toISOString(),
    changedBy: row.changedById ? { id: row.changedById, fullName: row.changedByName ?? "" } : null
  };
}
