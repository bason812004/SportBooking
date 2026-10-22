import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it, mock } from "node:test";

const config = {
  PAYMENT_PROVIDER: "PAYOS", PAYMENT_API_KEY: "test-client", PAYMENT_SECRET_KEY: "test-api",
  PAYMENT_WEBHOOK_SECRET: "test-checksum", PAYMENT_RETURN_URL: "https://example.com/user/bookings"
};
mock.module("../../config/env.js", { namedExports: { env: config } });
let writes = 0;
mock.module("./payment.repository.js", { namedExports: { paymentRepository: {
  applyWebhook: async () => { writes++; return null; }
} } });
mock.module("../notifications/notification.service.js", { namedExports: { notificationService: {} } });
mock.module("../realtime/realtime.service.js", { namedExports: { realtimeService: {} } });
const { QrPaymentProvider } = await import("./providers/qrPayment.provider.js");
const { paymentService } = await import("./payment.service.js");
const provider = new QrPaymentProvider();

function input() {
  return { amount: 10000, currency: "VND" as const, orderId: "1790000000000", paymentReference: "BK123456", description: "Booking", expiresAt: new Date(Date.now() + 900000) };
}
function signed(data: Record<string, unknown>) {
  const text = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join("&");
  return { code: "00", success: true, data, signature: crypto.createHmac("sha256", config.PAYMENT_WEBHOOK_SECRET).update(text).digest("hex") };
}
function transaction(overrides = {}) {
  return { orderCode: 1790000000000, amount: 10000, reference: "BANK-TX-1", description: "BK123456", code: "00", ...overrides };
}

describe("payOS integration", () => {
  it("rejects missing credentials before making an API request", async t => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
    for (const key of ["PAYMENT_API_KEY", "PAYMENT_SECRET_KEY", "PAYMENT_WEBHOOK_SECRET"] as const) {
      const original = config[key];
      config[key] = "";
      try { await assert.rejects(provider.createQrPayment(input()), /Chưa cấu hình/); }
      finally { config[key] = original; }
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("sends the matching expiry, credentials and signed payment fields", async t => {
    const request = input();
    t.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.expiredAt, Math.floor(request.expiresAt.getTime() / 1000));
      assert.equal(body.description, request.paymentReference);
      assert.equal((options?.headers as Record<string, string>)["x-client-id"], config.PAYMENT_API_KEY);
      assert.equal((options?.headers as Record<string, string>)["x-api-key"], config.PAYMENT_SECRET_KEY);
      const text = `amount=10000&cancelUrl=${config.PAYMENT_RETURN_URL}&description=BK123456&orderCode=1790000000000&returnUrl=${config.PAYMENT_RETURN_URL}`;
      assert.equal(body.signature, crypto.createHmac("sha256", config.PAYMENT_WEBHOOK_SECRET).update(text).digest("hex"));
      return new Response(JSON.stringify({ code: "00", data: { orderCode: body.orderCode, amount: body.amount, checkoutUrl: "https://pay.payos.vn/web/example", qrCode: "000201-test" } }));
    });
    const result = await provider.createQrPayment(request);
    assert.equal(result.providerConfigured, true);
    assert.equal(result.qrPayload, "000201-test");
  });

  it("rejects partial numeric order IDs, invalid amounts and expired links", async () => {
    await assert.rejects(provider.createQrPayment({ ...input(), orderId: "123abc" }));
    await assert.rejects(provider.createQrPayment({ ...input(), amount: 0 }));
    await assert.rejects(provider.createQrPayment({ ...input(), expiresAt: new Date(0) }));
  });

  it("does not accept an incomplete successful provider response", async t => {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ code: "00", data: {} })));
    await assert.rejects(provider.createQrPayment(input()), /Thông tin thanh toán/);
  });

  it("verifies a real webhook and retains a stable transaction ID", async () => {
    const verified = await provider.verifyWebhook(signed(transaction()), {});
    assert.equal(verified.externalTransactionId, "BANK-TX-1");
    assert.equal(verified.verificationOnly, false);
    assert.equal(verified.amount, 10000);
  });

  it("rejects missing, malformed and tampered signatures", async () => {
    const payload = signed(transaction());
    await assert.rejects(provider.verifyWebhook({ ...payload, signature: "bad" }, {}), /Chữ ký/);
    await assert.rejects(provider.verifyWebhook({ ...payload, signature: undefined }, {}), /Chữ ký/);
    await assert.rejects(provider.verifyWebhook({ ...payload, data: { ...payload.data, amount: 20000 } }, {}), /Chữ ký/);
  });

  it("rejects signed payloads with no transaction reference or invalid amount", async () => {
    await assert.rejects(provider.verifyWebhook(signed(transaction({ reference: "" })), {}));
    await assert.rejects(provider.verifyWebhook(signed(transaction({ amount: -1 })), {}));
  });

  it("acknowledges only the signed documented verification sample without a DB write", async () => {
    const sample = transaction({ orderCode: 123, amount: 3000, reference: "TF230204212323", description: "VQRIO123" });
    writes = 0;
    assert.deepEqual(await paymentService.webhook("payos", signed(sample), {}), { ok: true, verification: true });
    assert.equal(writes, 0);
    await assert.rejects(paymentService.webhook("payos", { ...signed(sample), signature: "0".repeat(64) }, {}));
    assert.equal(writes, 0);
  });

  it("does not silently acknowledge an unknown real payment", async () => {
    writes = 0;
    await assert.rejects(paymentService.webhook("payos", signed(transaction()), {}), /Khong tim thay/);
    assert.equal(writes, 1);
  });

  it("rejects a webhook delivered under another provider route", async () => {
    writes = 0;
    await assert.rejects(paymentService.webhook("sepay", signed(transaction()), {}), /Provider/);
    assert.equal(writes, 0);
  });
});
