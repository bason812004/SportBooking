import type { Prisma } from "@prisma/client";

/**
 * Courts of a partner whose account an admin locked are hidden from customers: not listed, not shown and not
 * bookable online. Spread it into every public court query, next to the approval and active-status checks.
 */
export const partnerAccountActive = { partner: { user: { status: "ACTIVE" } } } satisfies Prisma.CourtWhereInput;
