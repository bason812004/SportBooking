import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { courtRepository } from "../courts/court.repository.js";
import { notificationService } from "../notifications/notification.service.js";
import { reportRepository } from "./report.repository.js";
import { REPORT_NOTICES, REPORT_REPLY_LIMIT, buildThread, excerpt, unansweredReplies } from "./report.thread.js";

const ALREADY_REPORTED = "Bạn đã báo cáo sân này, quản trị viên đang xem xét.";
const REPORT_CLOSED = "Báo cáo đã đóng nên không gửi thêm được. Nếu sân vẫn còn vấn đề, hãy gửi báo cáo mới.";
const NOT_FOUND = "Không tìm thấy báo cáo";

/** A report only its author may read: anyone else gets the same answer as for one that does not exist. */
async function ownReport(userId: string, id: string) {
  const report = await reportRepository.thread(id);
  if (!report || report.userId !== userId) throw new NotFoundError(NOT_FOUND);
  return report;
}

export const reportService = {
  /** One open report per customer and court (a unique index backs this when two arrive together). */
  async create(userId: string, input: { courtId: string; reason: string; description?: string }) {
    const court = await courtRepository.findPublicById(input.courtId);
    if (!court) throw new NotFoundError("Khong tim thay san");
    if (await reportRepository.pendingByUser(userId, input.courtId)) throw new ConflictError(ALREADY_REPORTED, "ALREADY_REPORTED");
    try {
      return await reportRepository.create({ ...input, description: input.description || undefined, userId });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError(ALREADY_REPORTED, "ALREADY_REPORTED");
      throw error;
    }
  },

  /** The reporter's view of their report: the conversation, and whether (and how much more) they may write. */
  async thread(userId: string, id: string) {
    const report = await ownReport(userId, id);
    const open = report.status === "PENDING";
    return {
      id: report.id,
      status: report.status,
      reason: report.reason,
      description: report.description,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      court: report.court,
      entries: buildThread(report, report.messages, "USER"),
      canReply: open,
      repliesLeft: open ? Math.max(0, REPORT_REPLY_LIMIT - unansweredReplies(report.messages)) : 0
    };
  },

  /**
   * The reporter answers while the report waits, at most REPORT_REPLY_LIMIT messages in a row before an admin
   * writes back. The report row is locked so a decision cannot land between the check and the message.
   */
  async reply(userId: string, id: string, content: string) {
    const report = await ownReport(userId, id);
    if (report.status !== "PENDING") throw new ConflictError(REPORT_CLOSED, "REPORT_CLOSED");
    const message = await reportRepository.transaction(async (tx) => {
      if (!(await reportRepository.lockPending(id, tx))) throw new ConflictError(REPORT_CLOSED, "REPORT_CLOSED");
      const latest = await reportRepository.latestMessages(id, REPORT_REPLY_LIMIT + 1, tx);
      if (unansweredReplies(latest) >= REPORT_REPLY_LIMIT) {
        throw new ConflictError(
          `Bạn đã gửi ${REPORT_REPLY_LIMIT} tin liên tiếp. Hãy chờ quản trị viên phản hồi rồi gửi tiếp.`,
          "REPORT_REPLY_LIMIT"
        );
      }
      return reportRepository.createMessage({ reportId: id, authorId: userId, content }, tx);
    });
    try {
      await notificationService.notifyAdmins({
        title: REPORT_NOTICES.REPLIED.title,
        content: `${report.user.fullName} về sân "${report.court.name}": ${excerpt(content, 200)}`,
        type: REPORT_NOTICES.REPLIED.type,
        metadata: { reportId: id, courtId: report.court.id }
      });
    } catch (error) {
      console.error("[Reports] Admin notification failed:", error);
    }
    return {
      id: message.id,
      kind: "MESSAGE" as const,
      authorRole: "USER" as const,
      authorName: message.author?.fullName ?? report.user.fullName,
      content: message.content,
      measures: [],
      createdAt: message.createdAt
    };
  }
};
