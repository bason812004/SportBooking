import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { ForbiddenError, ValidationError } from "../../../shared/errors/AppError.js";
import type {
  CreateQrPaymentInput,
  CreateQrPaymentResult,
  PaymentProvider,
  PaymentStatusResult,
  VerifiedPaymentWebhook
} from "./paymentProvider.interface.js";

function stableStringify(value: unknown) {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

function sign(payload: unknown, secret: string) {
  return crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

export class QrPaymentProvider implements PaymentProvider {
  async createQrPayment(input: CreateQrPaymentInput): Promise<CreateQrPaymentResult> {
    const providerConfigured = Boolean(env.PAYMENT_API_KEY && env.PAYMENT_SECRET_KEY);
    const qrPayload = [
      `provider=${env.PAYMENT_PROVIDER}`,
      `order=${input.orderId}`,
      `amount=${input.amount}`,
      `currency=${input.currency}`,
      `reference=${input.paymentReference}`,
      `expires=${input.expiresAt.toISOString()}`
    ].join("|");

    return {
      provider: env.PAYMENT_PROVIDER,
      externalOrderId: input.orderId,
      qrCodeUrl: providerConfigured ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrPayload)}` : null,
      qrPayload,
      providerConfigured
    };
  }

  async verifyWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentWebhook> {
    if (!env.PAYMENT_WEBHOOK_SECRET) throw new ForbiddenError("Chua cau hinh bi mat webhook thanh toan");
    const signature = headers["x-payment-signature"];
    if (typeof signature !== "string" || signature !== sign(payload, env.PAYMENT_WEBHOOK_SECRET)) {
      throw new ForbiddenError("Chu ky webhook thanh toan khong hop le");
    }

    const body = payload as Record<string, unknown>;
    const externalOrderId = String(body.externalOrderId ?? "");
    const externalTransactionId = String(body.externalTransactionId ?? "");
    const status = String(body.status ?? "");
    const amount = Number(body.amount);
    if (!externalOrderId || !externalTransactionId || !["PAID", "FAILED", "EXPIRED"].includes(status) || !Number.isFinite(amount)) {
      throw new ValidationError("Payload webhook thanh toan khong hop le");
    }

    return {
      provider: env.PAYMENT_PROVIDER,
      externalOrderId,
      externalTransactionId,
      status: status as "PAID" | "FAILED" | "EXPIRED",
      amount,
      rawPayload: payload
    };
  }

  async getPaymentStatus(): Promise<PaymentStatusResult> {
    return { status: "PENDING" };
  }
}

