import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
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
    const audit = await tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
        previousHash: previous?.currentHash,
        currentHash
      }
    });
    await tx.blockchainLog.create({
      data: {
        auditLogId: audit.id,
        entityType,
        entityId,
        payloadHash: currentHash,
        status: "PENDING",
        network: "NOT_CONFIGURED"
      }
    });
    return audit;
  });
}

export async function verifyAuditChain() {
  const logs = await prisma.auditLog.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
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
