import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";

type Db = Prisma.TransactionClient | typeof prisma;

export const reportRepository = {
  create(data: { userId: string; courtId: string; reason: string; description?: string }) {
    return prisma.report.create({ data });
  },

  pendingByUser(userId: string, courtId: string) {
    return prisma.report.findFirst({ where: { userId, courtId, status: "PENDING" }, select: { id: true } });
  },

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(work, { timeout: 15_000 });
  },

  /** A report with its conversation, for its author. */
  thread(id: string) {
    return prisma.report.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true } },
        court: { select: { id: true, name: true } },
        resolver: { select: { fullName: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true } } } }
      }
    });
  },

  /** Locks a report still waiting until the transaction ends (an admin closing it waits); false once it is closed. */
  async lockPending(id: string, db: Db) {
    const rows = await db.$queryRaw<Array<{ id: string }>>`select id from reports where id = ${id} and status = 'PENDING' for update`;
    return rows.length > 0;
  },

  /** The latest messages, newest first: enough to count the reporter's unanswered ones. */
  latestMessages(reportId: string, take: number, db: Db) {
    return db.reportMessage.findMany({
      where: { reportId },
      orderBy: { createdAt: "desc" },
      take,
      select: { authorRole: true, createdAt: true }
    });
  },

  createMessage(data: { reportId: string; authorId: string; content: string }, db: Db) {
    return db.reportMessage.create({
      data: { ...data, authorRole: "USER", kind: "MESSAGE" },
      include: { author: { select: { fullName: true } } }
    });
  }
};
