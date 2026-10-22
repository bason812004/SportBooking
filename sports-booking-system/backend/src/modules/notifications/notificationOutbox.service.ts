import { realtimeEvents } from "../realtime/realtime.events.js";
import { realtimeService } from "../realtime/realtime.service.js";
import { notificationOutboxRepository } from "./notificationOutbox.repository.js";

export async function deliverPendingAdminNotifications() {
  for (const event of await notificationOutboxRepository.due()) {
    let deliveries;
    try {
      deliveries = await notificationOutboxRepository.deliver(event.id);
    } catch (error) {
      await notificationOutboxRepository.retry(event.id, error instanceof Error ? error.message : "Delivery failed");
      continue;
    }
    // Persistence is committed before emitting. Reconnect/polling recovers a missed socket event.
    for (const notification of deliveries) {
      realtimeService.toUser(notification.userId, realtimeEvents.notificationNew, notification);
    }
  }
}

export function startAdminNotificationWorker() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await deliverPendingAdminNotifications(); }
    catch (error) { console.error("[AdminNotifications] Delivery sweep failed", error); }
    finally { running = false; }
  };
  const timer = setInterval(() => void run(), 3000);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
