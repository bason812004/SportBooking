import { createHash } from "node:crypto";
import { prisma } from "../../config/db.js";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function recordAdminAction(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  const previous = await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" } });
  const payload = {
    actorId,
    action,
    entityType,
    entityId,
    metadata: metadata ?? null,
    previousHash: previous?.currentHash ?? null
  };
  const currentHash = hash(payload);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<any[]>(`
      insert into audit_logs (
        actor_id, action, entity_type, entity_id, metadata, previous_hash, current_hash
      )
      values ($1, $2, $3, $4, $5::jsonb, $6, $7)
      returning id, actor_id as "actorId", action, entity_type as "entityType",
        entity_id as "entityId", metadata, previous_hash as "previousHash",
        current_hash as "currentHash", created_at as "createdAt"
    `, actorId, action, entityType, entityId, JSON.stringify(metadata ?? null), previous?.currentHash ?? null, currentHash);
    const audit = rows[0];
    await tx.$executeRawUnsafe(`
      insert into blockchain_logs (
        audit_log_id, entity_type, entity_id, payload_hash, status, network
      )
      values ($1::uuid, $2, $3, $4, 'PENDING', 'NOT_CONFIGURED')
    `, audit.id, entityType, entityId, currentHash);
    return audit;
  });
}

const VERIFY_BATCH_SIZE = 500;

export async function verifyAuditChain() {
  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;
  let previousHash: string | null = null;
  let checked = 0;

  while (true) {
    const rows: any[] = await prisma.$queryRawUnsafe<any[]>(`
      select id, actor_id as "actorId", action, entity_type as "entityType",
        entity_id as "entityId", metadata, previous_hash as "previousHash",
        current_hash as "currentHash", created_at as "createdAt"
      from audit_logs
      where $1::timestamptz is null or (created_at, id) > ($1::timestamptz, $2::uuid)
      order by created_at asc, id asc
      limit $3
    `, cursorCreatedAt, cursorId, VERIFY_BATCH_SIZE);

    for (const log of rows) {
      const expectedPrevious = checked === 0 ? null : previousHash;
      const expectedHash = hash({
        actorId: log.actorId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata ?? null,
        previousHash: expectedPrevious
      });
      if ((log.previousHash ?? null) !== expectedPrevious || log.currentHash !== expectedHash) {
        return { valid: false, checked: checked + 1, brokenAt: log.id };
      }
      previousHash = log.currentHash;
      checked += 1;
    }

    if (rows.length < VERIFY_BATCH_SIZE) break;
    const last = rows[rows.length - 1];
    cursorCreatedAt = last.createdAt;
    cursorId = last.id;
  }

  return { valid: true, checked, brokenAt: null };
}
