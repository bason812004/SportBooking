import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { serviceRepository } from "./service.repository.js";
import type { CreateServiceCategoryInput, CreateServiceInput, UpdateServiceInput } from "./service.types.js";

export const serviceService = {
  async listCategories() {
    return serviceRepository.listCategories();
  },

  async createCategory(data: CreateServiceCategoryInput) {
    return serviceRepository.createCategory(data);
  },

  async listPartnerServices(partnerId: string, categoryId?: string, search?: string, courtId?: string) {
    return serviceRepository.listPartnerServices(partnerId, categoryId, search, courtId);
  },

  async listServicesForCourt(courtId: string, categoryId?: string) {
    return serviceRepository.listServicesForCourt(courtId, categoryId);
  },

  async getServiceById(id: string) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    return service;
  },

  async createService(partnerId: string, data: CreateServiceInput) {
    if (data.price < 0) throw new ValidationError("Giá bán không hợp lệ");
    const created = await serviceRepository.createService(partnerId, data);
    if (data.imageUrl !== undefined && created) {
      await serviceRepository.applyImageToPartnerServices(partnerId, created.name, data.imageUrl ?? null);
    }
    return created;
  },

  async updateService(partnerId: string, id: string, data: UpdateServiceInput) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    if (service.partnerId !== partnerId) throw new ValidationError("Không có quyền chỉnh sửa dịch vụ này");
    const updated = await serviceRepository.updateService(id, data);
    // The picture is shared by every court's row for this product; the rest stays per court.
    if (data.imageUrl !== undefined) {
      await serviceRepository.applyImageToPartnerServices(partnerId, updated?.name ?? service.name, data.imageUrl ?? null);
    }
    return updated;
  },

  async deleteService(partnerId: string, id: string) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    if (service.partnerId !== partnerId) throw new ValidationError("Không có quyền xóa dịch vụ này");
    return serviceRepository.deleteService(id);
  }
};
