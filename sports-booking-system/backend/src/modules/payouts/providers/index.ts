import type { PayoutProvider } from "./payoutProvider.interface.js";
import { FakePayoutProvider } from "./fakePayout.provider.js";

export const payoutProvider: PayoutProvider = new FakePayoutProvider();
