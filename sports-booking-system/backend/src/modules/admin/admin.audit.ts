import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortKeys(record[key])]));
  }
  return value;
}

/**
 * JSON with the keys of every object sorted. Metadata is stored as jsonb, which reorders keys, so a hash over plain
 * JSON.stringify could not be recomputed from what is read back.
 */
export function canonicalJson(value: unknown) {
  return JSON.stringify(sortKeys(JSON.parse(JSON.stringify(value ?? null))));
}

export type AuditHashInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  previousHash: string | null;
};

/**
 * Locks the chain head (audit_chain_head, database/30_audit_chain_head.sql) and returns the hash to chain onto.
 * The row lock is what keeps the chain single: under Read Committed a second writer waits here, then reads the head
 * the first one committed; under Serializable (the booking-overdue job) it fails with a serialization error instead
 * of chaining onto a head its snapshot no longer sees, and the job tries again on its next run.
 */
async function lockChainHead(tx: Prisma.TransactionClient) {
  const read = () => tx.$queryRaw<Array<{ currentHash: string | null }>>`
    select current_hash as "currentHash" from audit_chain_head where id = 1 for update
  `;
  let [head] = await read();
  if (!head) {
    // A database that has entries from before the head row existed: start from its newest entry.
    await tx.$executeRaw`
      insert into audit_chain_head (id, current_hash)
      select 1, (select current_hash from audit_logs order by created_at desc, id desc limit 1)
      on conflict (id) do nothing
    `;
    [head] = await read();
  }
  return head.currentHash ?? null;
}

export function auditHash(entry: AuditHashInput) {
  const payload = {
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
    previousHash: entry.previousHash
  };
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

/**
 * Appends an entry to the hash chain. `actorId` is null for actions the system takes on its own. Pass the caller's
 * transaction so the entry commits (or rolls back) with the change it records.
 */
export async function recordAdminAction(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
  db?: Prisma.TransactionClient
) {
  const write = async (tx: Prisma.TransactionClient) => {
    const previousHash = await lockChainHead(tx);
    const currentHash = auditHash({ actorId, action, entityType, entityId, metadata: metadata ?? null, previousHash });
    // clock_timestamp(), not the transaction's start time: taken under the head lock, it orders entries as they chain.
    const rows = await tx.$queryRawUnsafe<any[]>(`
      insert into audit_logs (
        actor_id, action, entity_type, entity_id, metadata, previous_hash, current_hash, created_at
      )
      values ($1, $2, $3, $4, $5::jsonb, $6, $7, clock_timestamp())
      returning id, actor_id as "actorId", action, entity_type as "entityType",
        entity_id as "entityId", metadata, previous_hash as "previousHash",
        current_hash as "currentHash", created_at as "createdAt"
    `, actorId, action, entityType, entityId, JSON.stringify(metadata ?? null), previousHash, currentHash);
    const audit = rows[0];
    await tx.$executeRaw`update audit_chain_head set current_hash = ${currentHash}, updated_at = now() where id = 1`;
    // Queued for anchoring on a blockchain; no provider is configured, so entries stay PENDING.
    await tx.$executeRawUnsafe(`
      insert into blockchain_logs (
        audit_log_id, entity_type, entity_id, payload_hash, status, network
      )
      values ($1::uuid, $2, $3, $4, 'PENDING', 'NOT_CONFIGURED')
    `, audit.id, entityType, entityId, currentHash);
    return audit;
  };
  return db ? write(db) : prisma.$transaction(write);
}

const VERIFY_BATCH_SIZE = 500;

/**
 * Walks the chain from the first entry: each must link to the one before and hash to what it stores. The last entry
 * must then be the recorded head, which a chain cut short at its end would not show otherwise.
 */
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
      const expectedHash = auditHash({
        actorId: log.actorId ?? null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata ?? null,
        previousHash: expectedPrevious
      });
      if ((log.previousHash ?? null) !== expectedPrevious || log.currentHash !== expectedHash) {
        return { valid: false, checked: checked + 1, brokenAt: log.id as string };
      }
      previousHash = log.currentHash;
      checked += 1;
    }

    if (rows.length < VERIFY_BATCH_SIZE) break;
    const last = rows[rows.length - 1];
    cursorCreatedAt = last.createdAt;
    cursorId = last.id;
  }

  const [head] = await prisma.$queryRaw<Array<{ currentHash: string | null }>>`
    select current_hash as "currentHash" from audit_chain_head where id = 1
  `;
  if (head && (head.currentHash ?? null) !== previousHash) {
    return { valid: false, checked, brokenAt: null, headMismatch: true };
  }
  return { valid: true, checked, brokenAt: null };
}
