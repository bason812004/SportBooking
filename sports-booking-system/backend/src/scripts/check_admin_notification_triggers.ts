// Runs real PostgreSQL trigger checks against temporary tables only, inside one transaction that is
// always rolled back: no live court/user/notification rows are created, updated or sent.
// Optional argument: a SQL file that (re)defines public.enqueue_admin_review_notification(). It is
// applied inside the same transaction, so a candidate migration can be checked before it is run.
//   npx tsx src/scripts/check_admin_notification_triggers.ts [../database/<migration>.sql]
import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../config/db.js";
import { deliverAdminEvent } from "../modules/notifications/notificationOutbox.repository.js";

class RollBack extends Error {}
const candidateSql = process.argv[2] ? readFileSync(process.argv[2], "utf8") : null;

try {
  await prisma.$transaction(async (tx) => {
    if (candidateSql) await tx.$executeRawUnsafe(candidateSql);
    await tx.$executeRawUnsafe("SET LOCAL search_path TO pg_temp, public");
    await tx.$executeRawUnsafe(`CREATE TEMP TABLE admin_notification_outbox (
      id bigserial, title text, content text, type text, metadata jsonb,
      processed_at timestamptz, next_attempt_at timestamptz DEFAULT now(), last_error text
    ) ON COMMIT DROP`);
    await tx.$executeRawUnsafe("CREATE TEMP TABLE users (id text, role text, status text, full_name text) ON COMMIT DROP");
    await tx.$executeRawUnsafe(`CREATE TEMP TABLE notifications (
      id text DEFAULT md5(random()::text), user_id text, title text, content text, type text,
      metadata_json jsonb, is_read boolean DEFAULT false, created_at timestamptz DEFAULT now()
    ) ON COMMIT DROP`);
    await tx.$executeRawUnsafe(`INSERT INTO users VALUES ('admin1', 'ADMIN', 'ACTIVE', 'Admin 1'), ('admin2', 'ADMIN', 'ACTIVE', 'Admin 2'),
      ('locked', 'ADMIN', 'LOCKED', 'Locked'), ('user1', 'USER', 'ACTIVE', 'Nguyen Van A')`);
    const tables = ["courts", "partner_profiles", "blog_posts", "reports", "court_image_requests", "withdrawal_requests", "tournaments"];
    for (const table of tables) {
      // Identifiers come only from the constant list above.
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE ${table} (
        id text, status text, approval_status text, name text, title text, business_name text,
        author_id text, court_id text, partner_id text, reason text, amount numeric, replace_image_id text,
        court_count int, commission_rate numeric, updated_at timestamptz
      ) ON COMMIT DROP`);
      await tx.$executeRawUnsafe(`CREATE TRIGGER admin_review_notification AFTER INSERT OR UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION public.enqueue_admin_review_notification()`);
    }
    const count = async () => (await tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM admin_notification_outbox`)[0].count;

    await tx.$executeRawUnsafe("INSERT INTO partner_profiles(id, approval_status, business_name) VALUES ('p-test', 'PENDING', 'Sân Bóng Xanh')");
    await tx.$executeRawUnsafe("UPDATE partner_profiles SET commission_rate = 12 WHERE id = 'p-test'");
    await tx.$executeRawUnsafe("INSERT INTO courts(id, approval_status, name, partner_id) VALUES ('c-test', 'PENDING', 'Sân A', 'p-test')");
    // Writes to a court that is already pending: timestamp, surface count. None of them re-notify.
    await tx.$executeRawUnsafe("UPDATE courts SET updated_at = now() WHERE id = 'c-test'");
    await tx.$executeRawUnsafe("UPDATE courts SET court_count = 2 WHERE id = 'c-test'");
    await tx.$executeRawUnsafe("INSERT INTO blog_posts(id, status, title, author_id) VALUES ('b-test', 'DRAFT', 'Draft', 'user1')");
    assert.equal(await count(), 2, "partner + court submissions only; admin commission, court timestamp/surface count and drafts are ignored");

    // Approved, then edited by the partner: sent back for review.
    await tx.$executeRawUnsafe("UPDATE courts SET approval_status = 'APPROVED' WHERE id = 'c-test'");
    await tx.$executeRawUnsafe("UPDATE courts SET approval_status = 'PENDING', name = 'Sân A mới' WHERE id = 'c-test'");
    assert.equal(await count(), 3, "a court sent back to PENDING notifies again");

    await tx.$executeRawUnsafe("UPDATE blog_posts SET status = 'PENDING' WHERE id = 'b-test'");
    await tx.$executeRawUnsafe("INSERT INTO reports(id, court_id, reason) VALUES ('r-test', 'c-test', 'Sân bẩn')");
    await tx.$executeRawUnsafe("INSERT INTO court_image_requests(id, court_id, status) VALUES ('i-test', 'c-test', 'PENDING')");
    await tx.$executeRawUnsafe("UPDATE court_image_requests SET status = 'APPROVED' WHERE id = 'i-test'");
    await tx.$executeRawUnsafe("INSERT INTO withdrawal_requests(id, partner_id, amount) VALUES ('w-test', 'p-test', 1500000)");
    await tx.$executeRawUnsafe("INSERT INTO tournaments(id, status, title, partner_id) VALUES ('t-test', 'PENDING', 'Giải mùa thu', 'p-test')");
    const events = await tx.$queryRaw<Array<{ type: string; title: string; content: string }>>`
      SELECT type, title, content FROM admin_notification_outbox ORDER BY id`;
    assert.deepEqual(events.map((event) => event.type), [
      "PARTNER_APPROVAL_REQUESTED", "COURT_APPROVAL_REQUESTED", "COURT_APPROVAL_REQUESTED", "BLOG_UPDATE_REQUESTED",
      "REPORT_CREATED", "COURT_IMAGE_SUBMITTED", "WITHDRAWAL_CREATED", "TOURNAMENT_CREATED"
    ]);
    // Messages carry what an admin needs to triage.
    assert.deepEqual(events.map((event) => event.content), [
      "Sân Bóng Xanh vừa đăng ký làm đối tác.",
      "Sân Bóng Xanh gửi sân mới: Sân A.",
      "Sân Bóng Xanh cập nhật thông tin sân: Sân A mới.",
      "Nguyen Van A gửi bài viết: Draft",
      "Sân A mới bị báo cáo: Sân bẩn.",
      "Sân A mới: gửi ảnh mới.",
      "Sân Bóng Xanh yêu cầu rút 1.500.000đ.",
      "Sân Bóng Xanh gửi giải đấu: Giải mùa thu"
    ]);
    assert.equal(events[2].title, "Sân cần duyệt lại");

    // Business rollback also rolls back its queued notification.
    await tx.$executeRawUnsafe("SAVEPOINT business_action");
    await tx.$executeRawUnsafe("INSERT INTO reports(id) VALUES ('rolled-back')");
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT business_action");
    assert.equal(await count(), 8);
    const [first] = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM admin_notification_outbox ORDER BY id LIMIT 1`;
    await tx.$executeRawUnsafe("SAVEPOINT delivery");
    assert.equal((await deliverAdminEvent(tx, first.id)).length, 2);
    assert.equal((await deliverAdminEvent(tx, first.id)).length, 0, "processed events must not be delivered twice");
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT delivery");
    assert.equal((await tx.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM notifications`)[0].count, 0);
    assert.equal((await deliverAdminEvent(tx, first.id)).length, 2, "rolled-back deliveries must be retryable");
    const recipients = await tx.$queryRaw<Array<{ user_id: string }>>`SELECT user_id FROM notifications ORDER BY user_id`;
    assert.deepEqual(recipients.map((row) => row.user_id), ["admin1", "admin2"]);
    console.log(`Function under test: ${candidateSql ? process.argv[2] : "live public.enqueue_admin_review_notification()"}`);
    console.log("PASS: seven event types, drafts and writes to already-pending courts ignored, re-submission notified, detailed messages.");
    console.log("PASS: transactional rollback, real SQL fan-out, active admins only, no duplicate delivery, delivery rollback and retry.");
    throw new RollBack();
  }, { timeout: 60000 });
} catch (error) {
  if (!(error instanceof RollBack)) throw error;
} finally {
  await prisma.$disconnect();
}
