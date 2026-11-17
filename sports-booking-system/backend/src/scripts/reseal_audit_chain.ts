// One-off: recomputes the audit chain with canonical hashing (keys sorted), run 2026-10-28.
// Entries written before then were hashed over JSON in insertion order, which jsonb does not keep, so verifying them
// reported a break wherever metadata had more than one key, though no entry had been changed. Every link was
// checked first: the script refuses to run if any previous_hash does not point at the entry before it.
// The replaced hashes are kept in the AUDIT_CHAIN_RESEALED entry the script appends, as are the blockchain queue rows.
// Must run before database/29_audit_and_reports.sql, which makes audit_logs append-only.
//   npx tsx src/scripts/reseal_audit_chain.ts <admin user id> "<reason>"
import "dotenv/config";
import { prisma } from "../config/db.js";
import { auditHash, recordAdminAction, verifyAuditChain } from "../modules/admin/admin.audit.js";

const [actorId, reason] = process.argv.slice(2);
if (!actorId || !reason || reason.trim().length < 3) {
  console.error('Usage: npx tsx src/scripts/reseal_audit_chain.ts <admin user id> "<reason>"');
  process.exit(1);
}

try {
  const admin = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (admin?.role !== "ADMIN") throw new Error(`${actorId} is not an admin account`);

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(${7310001}::bigint)`;
      const rows = await tx.$queryRaw<Array<{
        id: string; actorId: string | null; action: string; entityType: string; entityId: string;
        metadata: unknown; previousHash: string | null; currentHash: string;
      }>>`
        select id, actor_id as "actorId", action, entity_type as "entityType", entity_id as "entityId", metadata,
          previous_hash as "previousHash", current_hash as "currentHash"
        from audit_logs order by created_at asc, id asc
      `;

      // Only the hashing changes: an entry that does not point at the one before it is a real break, not this bug.
      rows.forEach((row, index) => {
        const expected = index === 0 ? null : rows[index - 1].currentHash;
        if ((row.previousHash ?? null) !== expected) throw new Error(`Entry ${row.id} does not link to the one before it`);
      });

      const replaced: Array<{ id: string; previousHash: string | null; currentHash: string }> = [];
      let previousHash: string | null = null;
      for (const row of rows) {
        const currentHash = auditHash({ ...row, metadata: row.metadata ?? null, previousHash });
        if (row.previousHash !== previousHash || row.currentHash !== currentHash) {
          replaced.push({ id: row.id, previousHash: row.previousHash, currentHash: row.currentHash });
          await tx.$executeRaw`update audit_logs set previous_hash = ${previousHash}, current_hash = ${currentHash} where id = ${row.id}::uuid`;
          await tx.$executeRaw`update blockchain_logs set payload_hash = ${currentHash} where audit_log_id = ${row.id}::uuid`;
        }
        previousHash = currentHash;
      }

      await recordAdminAction(actorId, "AUDIT_CHAIN_RESEALED", "AUDIT_LOG", "chain", {
        reason: reason.trim(),
        checked: rows.length,
        resealed: replaced.length,
        replacedHashes: replaced
      }, tx);
      return { checked: rows.length, resealed: replaced.length };
    },
    { timeout: 60_000 }
  );

  console.log("Resealed:", result);
  console.log("Verify:", await verifyAuditChain());
} finally {
  await prisma.$disconnect();
}
