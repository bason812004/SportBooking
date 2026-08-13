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

  async listPartnerServices(partnerId: string, categoryId?: string, search?: string) {
    // Seed sample services if partner has none
    await serviceRepository.seedDefaultPartnerServices(partnerId);
    return serviceRepository.listPartnerServices(partnerId, categoryId, search);
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
    return serviceRepository.createService(partnerId, data);
  },

  async updateService(partnerId: string, id: string, data: UpdateServiceInput) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    if (service.partnerId !== partnerId) throw new ValidationError("Không có quyền chỉnh sửa dịch vụ này");
    return serviceRepository.updateService(id, data);
  },

  async deleteService(partnerId: string, id: string) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    if (service.partnerId !== partnerId) throw new ValidationError("Không có quyền xóa dịch vụ này");
    return serviceRepository.deleteService(id);
  }
};
