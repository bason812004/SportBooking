import type { Request, Response } from "express";
import { ValidationError } from "../../shared/errors/AppError.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { cloudinaryService } from "../../shared/services/cloudinary.service.js";
import { serviceService } from "./service.service.js";

function queryText(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

async function getPartnerId(userId: string): Promise<string> {
  const { partnerId } = await serviceService.ownScope(userId);
  return partnerId;
}

export const serviceController = {
  async listCategories(_req: Request, res: Response) {
    const categories = await serviceService.listCategories();
    return sendSuccess(res, categories);
  },

  async createCategory(req: Request, res: Response) {
    const category = await serviceService.createCategory({ ...req.body, description: req.body.description ?? undefined });
    return sendSuccess(res, category, 201, "Tạo danh mục dịch vụ thành công");
  },

  async listPartnerServices(req: Request, res: Response) {
    const { partnerId, managedCourtId } = await serviceService.ownScope(req.user!.id);
    // A receptionist sees only the court they manage, whatever courtId the client asks for.
    const courtId = managedCourtId ?? queryText(req.query.courtId);
    const services = await serviceService.listPartnerServices(partnerId, queryText(req.query.categoryId), queryText(req.query.search), courtId);
    return sendSuccess(res, services);
  },

  async listServices(req: Request, res: Response) {
    const courtId = queryText(req.query.courtId);
    const categoryId = queryText(req.query.categoryId);
    const search = queryText(req.query.search)?.toLowerCase();

    if (courtId) {
      const services = await serviceService.listServicesForCourt(req.user, courtId, categoryId);
      const filtered = search
        ? services.filter((s: any) => s.name?.toLowerCase().includes(search) || s.description?.toLowerCase().includes(search))
        : services;
      return sendSuccess(res, filtered);
    }

    const partnerId = queryText(req.query.partnerId);
    if (!partnerId) throw new ValidationError("Chọn sân (courtId) hoặc đối tác (partnerId) để xem dịch vụ");
    return sendSuccess(res, await serviceService.listPartnerCatalog(req.user, partnerId, categoryId, search));
  },

  async listCourtServices(req: Request, res: Response) {
    const services = await serviceService.listServicesForCourt(req.user, req.params.courtId, queryText(req.query.categoryId));
    return sendSuccess(res, services);
  },

  async getServiceById(req: Request, res: Response) {
    const service = await serviceService.getServiceById(req.user, req.params.id);
    return sendSuccess(res, service);
  },

  async createService(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const body = req.body;
    const services = await serviceService.createService(partnerId, {
      ...body,
      description: body.description ?? undefined,
      categoryId: body.categoryId ?? undefined,
      sportType: body.sportType ?? undefined,
      imageUrl: body.imageUrl ?? undefined
    }, req.user!.id);
    return sendSuccess(res, services, 201, services.length > 1 ? `Đã tạo dịch vụ cho ${services.length} sân` : "Tạo dịch vụ thành công");
  },

  async updateService(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const service = await serviceService.updateService(partnerId, req.params.id, req.body, req.user!.id);
    return sendSuccess(res, service, 200, "Cập nhật dịch vụ thành công");
  },

  async priceHistory(req: Request, res: Response) {
    return sendSuccess(res, await serviceService.priceHistory(req.user!.id, req.params.id));
  },

  async deleteService(req: Request, res: Response) {
    const partnerId = await getPartnerId(req.user!.id);
    const result = await serviceService.deleteService(partnerId, req.params.id);
    return sendSuccess(
      res,
      result,
      200,
      result.deleted ? "Đã xóa dịch vụ" : "Dịch vụ đã có lịch sử bán hoặc nhập kho nên được chuyển sang Ngừng bán thay vì xóa"
    );
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
