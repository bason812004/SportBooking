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

export async function verifyAuditChain() {
  const logs = await prisma.$queryRawUnsafe<any[]>(`
    select id, actor_id as "actorId", action, entity_type as "entityType",
      entity_id as "entityId", metadata, previous_hash as "previousHash",
      current_hash as "currentHash", created_at as "createdAt"
    from audit_logs
    order by created_at asc, id asc
  `);
  for (let index = 0; index < logs.length; index += 1) {
    const expectedPrevious = index === 0 ? null : logs[index - 1].currentHash;
    const expectedHash = hash({
      actorId: logs[index].actorId,
      action: logs[index].action,
      entityType: logs[index].entityType,
      entityId: logs[index].entityId,
      metadata: logs[index].metadata ?? null,
      previousHash: expectedPrevious
    });
    if ((logs[index].previousHash ?? null) !== expectedPrevious || logs[index].currentHash !== expectedHash) {
      return { valid: false, checked: index + 1, brokenAt: logs[index].id };
    }
  }
  return { valid: true, checked: logs.length, brokenAt: null };
}
