import type { Request, Response } from "express";
import { prisma } from "../../config/db.js";
import { ForbiddenError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { serviceService } from "./service.service.js";
import { createServiceCategorySchema, createServiceSchema, updateServiceSchema } from "./service.validation.js";

async function getPartnerId(userId: string): Promise<string> {
  const partner = await prisma.partnerProfile.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (partner) return partner.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { partnerId: true, managedCourt: { select: { partnerId: true } } }
  });

  if (user?.partnerId) return user.partnerId;
  if (user?.managedCourt?.partnerId) return user.managedCourt.partnerId;

  const firstPartner = await prisma.partnerProfile.findFirst({ select: { id: true } });
  return firstPartner?.id || "p0001";
}

export const serviceController = {
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
    try {
      if (req.user?.id) {
        partnerId = await getPartnerId(req.user.id);
      }
    } catch {}

    const categoryId = typeof req.query.categoryId === "string" && req.query.categoryId.trim() !== "" ? req.query.categoryId.trim() : undefined;
    const search = typeof req.query.search === "string" && req.query.search.trim() !== "" ? req.query.search.trim() : undefined;
    const services = await serviceService.listPartnerServices(partnerId, categoryId, search);
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
  }
};
