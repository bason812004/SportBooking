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
    const provider = env.PAYMENT_PROVIDER;
    const providerConfigured = Boolean(env.PAYMENT_API_KEY && env.PAYMENT_SECRET_KEY);

    if (provider === "PAYOS") {
      if (!providerConfigured) {
        return {
          provider: "PAYOS",
          externalOrderId: input.orderId,
          qrCodeUrl: null,
          qrPayload: null,
          providerConfigured: false
        };
      }

      const orderCode = Number.parseInt(input.orderId, 10);
      if (Number.isNaN(orderCode)) {
        throw new ValidationError("PayOS orderCode must be a number");
      }

      // PayOS description: Max 25 alphanumeric chars, no accents/special chars (spaces allowed)
      const cleanDescription = input.description
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .substring(0, 25)
        .trim();

      const cancelUrl = env.PAYMENT_RETURN_URL || "http://localhost:5173/user/bookings";
      const returnUrl = env.PAYMENT_RETURN_URL || "http://localhost:5173/user/bookings";

      const signData = `amount=${input.amount}&cancelUrl=${cancelUrl}&description=${cleanDescription}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
      const signature = crypto.createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET || "").update(signData).digest("hex");

      const body = {
        orderCode,
        amount: input.amount,
        description: cleanDescription,
        cancelUrl,
        returnUrl,
        signature
      };

      try {
        const response = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
          method: "POST",
          headers: {
            "x-client-id": env.PAYMENT_API_KEY || "",
            "x-api-key": env.PAYMENT_SECRET_KEY || "",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        const resData = await response.json() as any;
        if (!response.ok || resData.code !== "00") {
          console.error("PayOS Create Payment Error:", resData);
          throw new ValidationError(`Lỗi kết nối cổng thanh toán PayOS: ${resData.desc || "Không rõ nguyên nhân"}`);
        }

        return {
          provider: "PAYOS",
          externalOrderId: input.orderId,
          qrCodeUrl: resData.data.checkoutUrl,
          qrPayload: resData.data.qrCode,
          providerConfigured: true
        };
      } catch (err: any) {
        console.error("PayOS creation failed:", err);
        throw new ValidationError(err.message || "Không thể tạo liên kết thanh toán PayOS");
      }
    }

    if (provider === "SEPAY") {
      const qrCodeUrl = `https://img.vietqr.io/image/${env.PAYMENT_BANK_ID.toLowerCase()}-${env.PAYMENT_BANK_ACCOUNT}-compact.jpg?amount=${input.amount}&addInfo=${encodeURIComponent(input.paymentReference)}&t=${input.orderId}`;
      return {
        provider: "SEPAY",
        externalOrderId: input.orderId,
        qrCodeUrl,
        qrPayload: input.paymentReference,
        providerConfigured: true
      };
    }

    // Default LOCAL_QR behavior
    const qrPayload = [
      `provider=${env.PAYMENT_PROVIDER}`,
      `order=${input.orderId}`,
      `amount=${input.amount}`,
      `currency=${input.currency}`,
      `reference=${input.paymentReference}`,
      `expires=${input.expiresAt.toISOString()}`
    ].join("|");

    const qrCodeUrl = `https://img.vietqr.io/image/${env.PAYMENT_BANK_ID.toLowerCase()}-${env.PAYMENT_BANK_ACCOUNT}-compact.jpg?amount=${input.amount}&addInfo=${encodeURIComponent(input.paymentReference)}&t=${input.orderId}`;

    return {
      provider: env.PAYMENT_PROVIDER,
      externalOrderId: input.orderId,
      qrCodeUrl,
      qrPayload,
      providerConfigured
    };
  }

  async verifyWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentWebhook> {
    const provider = env.PAYMENT_PROVIDER;

    if (provider === "PAYOS") {
      const body = payload as any;
      const data = body.data;
      if (!data) throw new ValidationError("Payload webhook PayOS không hợp lệ");

      if (!env.PAYMENT_WEBHOOK_SECRET) {
        throw new ForbiddenError("Chưa cấu hình mật mã bảo mật webhook (PAYMENT_WEBHOOK_SECRET)");
      }

      const sortedKeys = Object.keys(data).sort();
      const signString = sortedKeys
        .map((k) => {
          const val = data[k];
          const strVal = typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);
          return `${k}=${strVal}`;
        })
        .join("&");

      const signature = crypto.createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET).update(signString).digest("hex");
      if (signature !== body.signature) {
        throw new ForbiddenError("Chữ ký webhook PayOS không hợp lệ");
      }

      return {
        provider: "PAYOS",
        externalOrderId: String(data.orderCode),
        externalTransactionId: data.reference || `PAYOS_TX_${Date.now()}`,
        status: data.code === "00" ? "PAID" : "FAILED",
        amount: data.amount,
        rawPayload: payload
      };
    }

    if (provider === "SEPAY") {
      const authHeader = headers["authorization"];
      const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

      if (!env.PAYMENT_WEBHOOK_SECRET) {
        throw new ForbiddenError("Chưa cấu hình mật mã bảo mật webhook (PAYMENT_WEBHOOK_SECRET)");
      }
      if (token !== env.PAYMENT_WEBHOOK_SECRET) {
        throw new ForbiddenError("Bearer token SePay không hợp lệ");
      }

      const body = payload as any;
      const paymentReference = body.content || body.transactionContent;
      const amount = Number(body.transferAmount || body.amountIn || 0);
      const externalTransactionId = String(body.referenceCode || body.id || `SEPAY_TX_${Date.now()}`);

      if (!paymentReference) {
        throw new ValidationError("Nội dung giao dịch không chứa tham chiếu thanh toán");
      }

      return {
        provider: "SEPAY",
        externalOrderId: "",
        externalTransactionId,
        status: "PAID",
        amount,
        rawPayload: payload,
        paymentReference
      };
    }

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

