import { env } from "../../../config/env.js";
import type { PayoutProvider } from "./payoutProvider.interface.js";
import { FakePayoutProvider } from "./fakePayout.provider.js";

/**
 * Bank payouts are manual by default: there is no disbursement contract, so an admin approves a
 * withdrawal, transfers the money from the platform's bank and confirms "Đã chuyển khoản" (markPaid).
 * PAYOUT_PROVIDER=fake plugs in a simulator that auto-confirms transfers for demos; it never moves
 * money, so it is refused in production.
 */
function createPayoutProvider(): PayoutProvider | null {
  if (env.PAYOUT_PROVIDER === "manual") return null;
  if (env.NODE_ENV === "production") {
    throw new Error("PAYOUT_PROVIDER=fake chi dung de demo, khong duoc bat tren production");
  }
  return new FakePayoutProvider();
}

const provider = createPayoutProvider();

/** The automatic payout provider, or null when payouts are confirmed by hand. */
export function activePayoutProvider() {
  return provider;
}
