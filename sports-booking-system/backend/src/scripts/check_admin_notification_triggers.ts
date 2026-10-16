// Runs real PostgreSQL trigger checks against temporary tables only.
// No live court/user/notification rows are created, updated or sent.
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../config/db.js";
import { deliverAdminEvent } from "../modules/notifications/notificationOutbox.repository.js";

try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL search_path TO pg_temp, public");
    await tx.$executeRawUnsafe(`CREATE TEMP TABLE admin_notification_outbox (
      id bigserial, title text, content text, type text, metadata jsonb,
      processed_at timestamptz, next_attempt_at timestamptz DEFAULT now(), last_error text
    ) ON COMMIT DROP`);
    await tx.$executeRawUnsafe("CREATE TEMP TABLE users (id text, role text, status text) ON COMMIT DROP");
    await tx.$executeRawUnsafe(`CREATE TEMP TABLE notifications (
      id text DEFAULT md5(random()::text), user_id text, title text, content text, type text,
      metadata_json jsonb, is_read boolean DEFAULT false, created_at timestamptz DEFAULT now()
    ) ON COMMIT DROP`);
    await tx.$executeRawUnsafe("INSERT INTO users VALUES ('admin1', 'ADMIN', 'ACTIVE'), ('admin2', 'ADMIN', 'ACTIVE'), ('locked', 'ADMIN', 'LOCKED'), ('user1', 'USER', 'ACTIVE')");
    const tables = ["courts", "partner_profiles", "blog_posts", "reports", "court_image_requests", "withdrawal_requests", "tournaments"];
    for (const table of tables) {
      // Identifiers come only from the constant list above.
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE ${table} (
        id text, status text, approval_status text, name text, title text,
        author_id text, court_id text, partner_id text, updated_at timestamptz
      ) ON COMMIT DROP`);
      await tx.$executeRawUnsafe(`CREATE TRIGGER admin_review_notification AFTER INSERT OR UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION public.enqueue_admin_review_notification()`);
    }
    await tx.$executeRawUnsafe("INSERT INTO courts(id, approval_status, name) VALUES ('c-test', 'PENDING', 'Test court')");
    await tx.$executeRawUnsafe("UPDATE courts SET updated_at = now() WHERE id = 'c-test'");
    await tx.$executeRawUnsafe("INSERT INTO partner_profiles(id, approval_status) VALUES ('p-test', 'PENDING')");
    await tx.$executeRawUnsafe("INSERT INTO blog_posts(id, status, title) VALUES ('b-test', 'DRAFT', 'Draft')");
    assert.equal((await tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM admin_notification_outbox`)[0].count, 2);
    await tx.$executeRawUnsafe("UPDATE blog_posts SET status = 'PENDING' WHERE id = 'b-test'");
    await tx.$executeRawUnsafe("INSERT INTO reports(id, court_id) VALUES ('r-test', 'c-test')");
    await tx.$executeRawUnsafe("INSERT INTO court_image_requests(id, court_id, status) VALUES ('i-test', 'c-test', 'PENDING')");
    await tx.$executeRawUnsafe("UPDATE court_image_requests SET status = 'APPROVED' WHERE id = 'i-test'");
    await tx.$executeRawUnsafe("INSERT INTO withdrawal_requests(id, partner_id) VALUES ('w-test', 'p-test')");
    await tx.$executeRawUnsafe("INSERT INTO tournaments(id, status, title) VALUES ('t-test', 'PENDING', 'Tournament test')");
    const events = await tx.$queryRaw<Array<{ type: string }>>`SELECT type FROM admin_notification_outbox ORDER BY type`;
    assert.deepEqual(events.map((event) => event.type), [
      "BLOG_UPDATE_REQUESTED", "COURT_APPROVAL_REQUESTED", "COURT_IMAGE_SUBMITTED",
      "PARTNER_APPROVAL_REQUESTED", "REPORT_CREATED", "TOURNAMENT_CREATED", "WITHDRAWAL_CREATED"
    ]);
    // Business rollback also rolls back its queued notification.
    await tx.$executeRawUnsafe("SAVEPOINT business_action");
    await tx.$executeRawUnsafe("INSERT INTO reports(id) VALUES ('rolled-back')");
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT business_action");
    assert.equal((await tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM admin_notification_outbox`)[0].count, 7);
    const [first] = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM admin_notification_outbox ORDER BY id LIMIT 1`;
    await tx.$executeRawUnsafe("SAVEPOINT delivery");
    assert.equal((await deliverAdminEvent(tx, first.id)).length, 2);
    assert.equal((await deliverAdminEvent(tx, first.id)).length, 0, "processed events must not be delivered twice");
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT delivery");
    assert.equal((await tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM notifications`)[0].count, 0);
    assert.equal((await deliverAdminEvent(tx, first.id)).length, 2, "rolled-back deliveries must be retryable");
    const recipients = await tx.$queryRaw<Array<{ user_id: string }>>`SELECT user_id FROM notifications ORDER BY user_id`;
    assert.deepEqual(recipients.map((row) => row.user_id), ["admin1", "admin2"]);
    console.log("PASS: seven event types, drafts ignored, no duplicate timestamp/approval events, transactional rollback.");
    console.log("PASS: real SQL fan-out, active admins only, no duplicate delivery, delivery rollback and retry.");
  }, { timeout: 60000 });
} finally { await prisma.$disconnect(); }
