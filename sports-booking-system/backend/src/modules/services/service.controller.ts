import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { ForbiddenError, ValidationError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { serviceService } from "./service.service.js";
import { forceSeedAllServicesToDb } from "./service.repository.js";
import { createServiceCategorySchema, createServiceSchema, updateServiceSchema } from "./service.validation.js";

async function getPartnerScope(userId: string): Promise<{ partnerId: string; managedCourtId: string | null }> {
  const partner = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (partner) return { partnerId: partner.id, managedCourtId: null };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { partnerId: true, managedCourtId: true, managedCourt: { select: { partnerId: true } } }
  });

  // A receptionist only ever runs one court, so their scope is pinned to it.
  if (user?.partnerId) return { partnerId: user.partnerId, managedCourtId: user.managedCourtId ?? null };
  if (user?.managedCourt?.partnerId) return { partnerId: user.managedCourt.partnerId, managedCourtId: user.managedCourtId ?? null };

  const firstPartner = await prisma.partnerProfile.findFirst({ select: { id: true } });
  return { partnerId: firstPartner?.id || "p0001", managedCourtId: null };
}

async function getPartnerId(userId: string): Promise<string> {
  const { partnerId } = await getPartnerScope(userId);
  return partnerId;
}

export const serviceController = {
  async redistributeServices(_req: Request, res: Response) {
    await forceSeedAllServicesToDb();
    return sendSuccess(res, { message: "Redistributed services successfully" });
  },

  async listCategories(_req: Request, res: Response) {
    const categories = await serviceService.listCategories();
    return sendSuccess(res, categories);
  },

  async createCategory(req: Request, res: Response) {
    const body = createServiceCategorySchema.parse(req.body);
    const category = await serviceService.createCategory({ ...body, description: body.description ?? undefined });
    return sendSuccess(res, category, 201, "Tạo danh mục dịch vụ thành công");
  },

  async listPartnerServices(req: Request, res: Response) {
    let partnerId = "";
    let managedCourtId: string | null = null;
    try {
      if (req.user?.id) {
        ({ partnerId, managedCourtId } = await getPartnerScope(req.user.id));
      }
    } catch {}

    const categoryId = typeof req.query.categoryId === "string" && req.query.categoryId.trim() !== "" ? req.query.categoryId.trim() : undefined;
    const search = typeof req.query.search === "string" && req.query.search.trim() !== "" ? req.query.search.trim() : undefined;
    // A receptionist sees only the court they manage, whatever courtId the client asks for.
    const requestedCourtId = typeof req.query.courtId === "string" && req.query.courtId.trim() !== "" ? req.query.courtId.trim() : undefined;
    const courtId = managedCourtId ?? requestedCourtId;
    const services = await serviceService.listPartnerServices(partnerId, categoryId, search, courtId);
    return sendSuccess(res, services);
  },

  async listCourtServices(req: Request, res: Response) {
    const courtId = req.params.courtId;
    const categoryId = req.query.categoryId as string | undefined;
    const services = await serviceService.listServicesForCourt(courtId, categoryId);
    return sendSuccess(res, services);
  },

  async getServiceById(req: Request, res: Response) {
    const service = await serviceService.getServiceById(req.params.id);
    return sendSuccess(res, service);
  },

  async createService(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const body = createServiceSchema.parse(req.body);
    const service = await serviceService.createService(partnerId, {
      ...body,
      description: body.description ?? undefined,
      categoryId: body.categoryId ?? undefined,
      sportType: body.sportType ?? undefined,
      imageUrl: body.imageUrl ?? undefined
    });
    return sendSuccess(res, service, 201, "Tạo dịch vụ thành công");
  },

  async updateService(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const body = updateServiceSchema.parse(req.body);
    const service = await serviceService.updateService(partnerId, req.params.id, body);
    return sendSuccess(res, service, 200, "Cập nhật dịch vụ thành công");
  },

  async deleteService(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    await serviceService.deleteService(partnerId, req.params.id);
    return sendSuccess(res, null, 200, "Xóa dịch vụ thành công");
  },

  async uploadServiceImage(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    if (!req.file) throw new ValidationError("Vui lòng chọn một file ảnh");
    const result = await cloudinaryService.uploadServiceImage(req.file, partnerId);
    return sendSuccess(
      res,
      {
        url: result.imageUrl,
        publicId: result.publicId,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        fileName: req.file.originalname
      },
      201,
      "Tải ảnh lên thành công"
    );
  }
};
