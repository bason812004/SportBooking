import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

type Event = { id: bigint; title: string; content: string; type: string; metadata: object };
type Delivery = { id: string; userId: string; title: string; content: string; type: string; metadata: object; isRead: boolean; createdAt: Date };

export const notificationOutboxRepository = {
  due() {
    return prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM admin_notification_outbox
      WHERE processed_at IS NULL AND next_attempt_at <= now() ORDER BY id LIMIT 20
    `;
  },
  deliver(id: bigint) {
    return prisma.$transaction((tx) => deliverAdminEvent(tx, id));
  },
  retry(id: bigint, error: string) {
    return prisma.$executeRaw`
      UPDATE admin_notification_outbox SET attempts = attempts + 1,
        next_attempt_at = now() + least(3600, 5 * power(2, least(attempts, 10))) * interval '1 second',
        last_error = ${error.slice(0, 500)}
      WHERE id = ${id} AND processed_at IS NULL
    `;
  }
};

// Shared transactional operation, also exercised with isolated PostgreSQL fixtures.
export async function deliverAdminEvent(tx: Prisma.TransactionClient, id: bigint) {
  const [event] = await tx.$queryRaw<Event[]>`
    SELECT id, title, content, type, metadata FROM admin_notification_outbox
    WHERE id = ${id} AND processed_at IS NULL AND next_attempt_at <= now()
    FOR UPDATE SKIP LOCKED
  `;
  if (!event) return [];
  const deliveries = await tx.$queryRaw<Delivery[]>`
    INSERT INTO notifications(user_id, title, content, type, metadata_json)
    SELECT id, ${event.title}, ${event.content}, ${event.type}, ${JSON.stringify(event.metadata)}::jsonb
    FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'
    RETURNING id, user_id AS "userId", title, content, type, metadata_json AS metadata,
      is_read AS "isRead", created_at AS "createdAt"
  `;
  if (!deliveries.length) throw new Error("No active administrator available");
  await tx.$executeRaw`UPDATE admin_notification_outbox SET processed_at = now(), last_error = NULL WHERE id = ${id}`;
  return deliveries;
}
