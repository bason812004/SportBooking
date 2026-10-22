import { prisma } from "../../config/db.js";
import { ConflictError, NotFoundError } from "../../shared/errors/AppError.js";

export const courtImageRepository = {
  ownedCourt(courtId: string, userId: string) {
    return prisma.court.findFirst({ where: { id: courtId, partner: { userId } } });
  },

  list(courtId?: string) {
    return prisma.courtImageRequest.findMany({
      where: courtId ? { courtId } : { status: "PENDING" },
      include: { court: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }
    });
  },

  submit(input: { courtId: string; imageUrl: string; publicId?: string; sortOrder?: number; replaceImageId?: string }) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM courts WHERE id = ${input.courtId} FOR UPDATE`;
      const target = input.replaceImageId
        ? await tx.courtImage.findFirst({ where: { id: input.replaceImageId, courtId: input.courtId } })
        : null;
      if (input.replaceImageId && !target) throw new NotFoundError("Không tìm thấy ảnh cần thay của sân này");
      if (target && await tx.courtImageRequest.findFirst({ where: { replaceImageId: target.id, status: "PENDING" } })) {
        throw new ConflictError("Ảnh này đang có yêu cầu thay thế chờ duyệt. Hãy hủy yêu cầu cũ trước.");
      }
      return tx.courtImageRequest.create({ data: { ...input, previousImageUrl: target?.imageUrl } });
    });
  },

  async cancel(id: string, userId: string) {
    const result = await prisma.courtImageRequest.updateMany({
      where: { id, status: "PENDING", court: { partner: { userId } } },
      data: { status: "CANCELLED", reviewedAt: new Date(), reviewedBy: userId }
    });
    if (!result.count) throw new ConflictError("Không tìm thấy yêu cầu chờ duyệt của bạn");
    return { id };
  },

  review(id: string, userId: string, decision: "APPROVED" | "REJECTED", reason?: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.courtImageRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundError("Không tìm thấy yêu cầu ảnh");
      // Serialize publication, replacement and deletion for each court.
      await tx.$queryRaw`SELECT id FROM courts WHERE id = ${request.courtId} FOR UPDATE`;
      const claimed = await tx.courtImageRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: decision, reason, reviewedAt: new Date(), reviewedBy: userId }
      });
      if (!claimed.count) throw new ConflictError("Yêu cầu đã được xử lý hoặc đã hủy");
      if (decision === "APPROVED") {
        if (request.replaceImageId) {
          const replaced = await tx.courtImage.updateMany({
            where: { id: request.replaceImageId, courtId: request.courtId, imageUrl: request.previousImageUrl ?? undefined },
            data: { imageUrl: request.imageUrl, publicId: request.publicId }
          });
          if (!replaced.count) throw new ConflictError("Ảnh gốc đã thay đổi. Hãy từ chối và yêu cầu gửi lại.");
        } else {
          // Append to the currently published gallery; the first approved image becomes the cover.
          const last = await tx.courtImage.aggregate({ where: { courtId: request.courtId }, _max: { sortOrder: true } });
          await tx.courtImage.create({ data: {
            courtId: request.courtId, imageUrl: request.imageUrl, publicId: request.publicId,
            sortOrder: (last._max.sortOrder ?? -1) + 1
          } });
        }
      }
      return { id, status: decision };
    });
  }
};
