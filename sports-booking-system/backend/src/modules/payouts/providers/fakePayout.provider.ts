import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { ForbiddenError, ValidationError } from "../../../shared/errors/AppError.js";
import type {
  CreatePayoutInput,
  CreatePayoutResult,
  PayoutProvider,
  VerifiedPayoutWebhook
} from "./payoutProvider.interface.js";

function stableStringify(value: unknown) {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

function sign(payload: unknown, secret: string) {
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

/**
 * Simulates a real bank/payout provider for testing, until a real disbursement
 * contract exists. Never touches the database directly — always round-trips
 * through the app's own webhook endpoint, like a real provider would, so the
 * whole async webhook path (idempotency, retries, FAILED handling) gets
 * exercised the same way it will with a real provider later.
 */
export class FakePayoutProvider implements PayoutProvider {
  async createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult> {
    const externalTransactionId = crypto.randomUUID();
    console.log(`[Payout] Provider Called (fake) — withdrawalId=${input.withdrawalId} externalTransactionId=${externalTransactionId}`);

    // Fire-and-forget: don't block the admin's "approve" request on this.
    void this.simulateWebhook(input, externalTransactionId).catch((error) => {
      console.error("[Payout] Fake provider simulation failed:", error);
    });

    console.log(`[Payout] PROCESSING — withdrawalId=${input.withdrawalId}`);
    return { provider: "fake", externalTransactionId, status: "PROCESSING" };
  }

  private async simulateWebhook(input: CreatePayoutInput, externalTransactionId: string) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const outcome = this.resolveOutcome(input.forceResult ?? "RANDOM");
    if (outcome === "TIMEOUT") {
      console.log(`[Payout] TIMEOUT simulated (no webhook sent) — withdrawalId=${input.withdrawalId}`);
      return;
    }

    const payload = { externalTransactionId, withdrawalId: input.withdrawalId, status: outcome };
    const signature = sign(payload, env.PAYOUT_WEBHOOK_SECRET || "dev-payout-secret");

    console.log(`[Payout] Webhook Sending — withdrawalId=${input.withdrawalId} status=${outcome}`);
    await fetch(`${env.APP_BASE_URL}/api/payouts/webhook/fake`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-payout-signature": signature },
      body: JSON.stringify(payload)
    });
  }

  private resolveOutcome(forceResult: "SUCCESS" | "FAILED" | "TIMEOUT" | "RANDOM"): "SUCCESS" | "FAILED" | "TIMEOUT" {
    if (forceResult !== "RANDOM") return forceResult;
    return Math.random() < env.PAYOUT_FAKE_SUCCESS_RATE ? "SUCCESS" : "FAILED";
  }

  async verifyWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPayoutWebhook> {
    const secret = env.PAYOUT_WEBHOOK_SECRET || "dev-payout-secret";
    const signature = headers["x-payout-signature"];
    if (typeof signature !== "string" || signature !== sign(payload, secret)) {
      throw new ForbiddenError("Chu ky webhook payout khong hop le");
    }

    const body = payload as Record<string, unknown>;
    const withdrawalId = String(body.withdrawalId ?? "");
    const externalTransactionId = String(body.externalTransactionId ?? "");
    const status = String(body.status ?? "");
    if (!withdrawalId || !externalTransactionId || !["SUCCESS", "FAILED"].includes(status)) {
      throw new ValidationError("Payload webhook payout khong hop le");
    }

    console.log(`[Payout] Webhook Received — withdrawalId=${withdrawalId} status=${status}`);
    return {
      provider: "fake",
      externalTransactionId,
      withdrawalId,
      status: status as "SUCCESS" | "FAILED",
      rawPayload: payload
    };
  }
}
