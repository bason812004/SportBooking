import { env } from "../../config/env.js";
import { prisma } from "../../config/db.js";
import { paymentRepository } from "./payment.repository.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { realtimeEvents } from "../realtime/realtime.events.js";

async function pollPayments() {
  try {
    const provider = env.PAYMENT_PROVIDER;
    const providerConfigured = Boolean(env.PAYMENT_API_KEY && env.PAYMENT_SECRET_KEY);
    if ((provider !== "PAYOS" && provider !== "SEPAY") || !providerConfigured) {
      return;
    }

    let pendingPayments;
    try {
      pendingPayments = await prisma.payment.findMany({
        where: { status: "PENDING" },
        include: { booking: true }
      });
    } catch (dbErr: any) {
      console.warn(`[Poller] Database temporary unreachable (${dbErr?.code || dbErr?.message?.slice(0, 60)})`);
      return;
    }

    if (pendingPayments.length === 0) return;

    for (const payment of pendingPayments) {
      if (payment.expiresAt.getTime() <= Date.now()) {
        continue;
      }

      if (provider === "PAYOS") {
        const orderCode = Number.parseInt(payment.externalOrderId, 10);
        if (Number.isNaN(orderCode)) continue;

        try {
          const response = await fetch(`https://api-merchant.payos.vn/v2/payment-requests/${orderCode}`, {
            method: "GET",
            headers: {
              "x-client-id": env.PAYMENT_API_KEY || "",
              "x-api-key": env.PAYMENT_SECRET_KEY || "",
              "Content-Type": "application/json"
            }
          });

          if (!response.ok) {
            const errText = await response.text();
            console.warn(`[Poller] PayOS API returned error status ${response.status} for payment ${payment.id}: ${errText.slice(0, 100)}`);
            continue;
          }

          const resData = await response.json() as any;
          if (response.ok && resData.code === "00" && resData.data) {
            const payosStatus = resData.data.status;
            if (payosStatus === "PAID") {
              console.log(`[Poller] Payment ${payment.id} verified as PAID via PayOS API`);
              
              const result = await paymentRepository.applyWebhook({
                provider: "PAYOS",
                externalOrderId: payment.externalOrderId,
                externalTransactionId: resData.data.transactions?.[0]?.reference || `PAYOS_POLL_${Date.now()}`,
                status: "PAID",
                amount: Number(payment.amount),
                rawPayload: resData.data
              });

              if (result) {
                const updatedPayment = result.payment;
                realtimeService.toUser(updatedPayment.userId, realtimeEvents.paymentPaid, updatedPayment);
                realtimeService.toBooking(updatedPayment.bookingId, realtimeEvents.paymentPaid, updatedPayment);
                realtimeService.toCourt(updatedPayment.booking.courtId, realtimeEvents.courtAvailabilityUpdated, { courtId: updatedPayment.booking.courtId });
              }
            } else if (payosStatus === "CANCELLED" || payosStatus === "EXPIRED") {
              console.log(`[Poller] Payment ${payment.id} cancelled/expired on PayOS`);
              await prisma.$transaction(async (tx) => {
                await tx.payment.update({
                  where: { id: payment.id },
                  data: { status: "CANCELLED" }
                });
                await tx.booking.update({
                  where: { id: payment.bookingId },
                  data: { bookingStatus: "CANCELLED", paymentStatus: "CANCELLED" }
                });
              });
            }
          }
        } catch (err) {
          console.error(`[Poller] PayOS check failed for payment ${payment.id}:`, err);
        }
      }

      if (provider === "SEPAY") {
        try {
          const response = await fetch("https://api.sepay.vn/user/api/transactions?limit=20", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${env.PAYMENT_API_KEY || env.PAYMENT_SECRET_KEY || ""}`
            }
          });

          const resData = await response.json() as any;
          if (response.ok && resData.transactions && Array.isArray(resData.transactions)) {
            const matchingTx = resData.transactions.find((tx: any) => {
              const content = String(tx.transaction_content || tx.content || "");
              return content.toUpperCase().includes(payment.paymentReference.toUpperCase());
            });

            if (matchingTx) {
              const transferAmount = Number(matchingTx.transferAmount || matchingTx.amount_in || 0);
              console.log(`[Poller] Payment ${payment.id} verified as PAID via SePay API`);
              
              const result = await paymentRepository.applyWebhook({
                provider: "SEPAY",
                externalOrderId: payment.externalOrderId,
                paymentReference: payment.paymentReference,
                externalTransactionId: String(matchingTx.reference_code || matchingTx.id),
                status: "PAID",
                amount: transferAmount,
                rawPayload: matchingTx
              });

              if (result) {
                const updatedPayment = result.payment;
                realtimeService.toUser(updatedPayment.userId, realtimeEvents.paymentPaid, updatedPayment);
                realtimeService.toBooking(updatedPayment.bookingId, realtimeEvents.paymentPaid, updatedPayment);
                realtimeService.toCourt(updatedPayment.booking.courtId, realtimeEvents.courtAvailabilityUpdated, { courtId: updatedPayment.booking.courtId });
              }
            }
          }
        } catch (err) {
          console.error(`[Poller] SePay check failed for payment ${payment.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("[Poller] Payment poller error:", error);
  }
}

export function startPaymentPoller() {
  const provider = env.PAYMENT_PROVIDER;
  if (provider === "PAYOS" || provider === "SEPAY") {
    console.log(`[Poller] Starting background payment transaction poller for ${provider} (every 10s)...`);
    setInterval(pollPayments, 10000);
  }
}
