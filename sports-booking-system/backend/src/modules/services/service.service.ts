import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { serviceRepository } from "./service.repository.js";
import type { CreateServiceCategoryInput, CreateServiceInput, ServiceViewer, UpdateServiceInput } from "./service.types.js";

async function ownScope(userId: string) {
  const scope = await serviceRepository.partnerScope(userId);
  if (!scope) throw new ForbiddenError("Tài khoản chưa gắn với đối tác nào");
  return scope;
}

/** Whether the viewer runs this partner's counter (or is an admin): only they see cost prices and stock. */
async function seesInternals(viewer: ServiceViewer, partnerId: string | null | undefined, courtId?: string | null) {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  if (!partnerId || (viewer.role !== "PARTNER" && viewer.role !== "RECIPIENT")) return false;
  const scope = await serviceRepository.partnerScope(viewer.id);
  if (!scope || scope.partnerId !== partnerId) return false;
  return !scope.managedCourtId || !courtId || scope.managedCourtId === courtId;
}

/**
 * What a customer sees of a product: no cost or purchase price, and of the stock only how many can still be ordered
 * (null when the item is not counted, as rental gear without a stock row).
 */
function publicView(service: any) {
  const { costPrice: _cost, inventory, ...rest } = service;
  const counted = Boolean(inventory?.id);
  const available = counted
    ? Math.max(0, Number(inventory.quantity ?? 0) - Number(inventory.reservedQuantity ?? 0))
    : service.type === "PRODUCT" && service.trackInventory
    ? 0
    : null;
  return { ...rest, inventory: available == null ? null : { quantity: available } };
}

async function assertNameFree(courtIds: string[], name: string, exceptId?: string) {
  const taken = await serviceRepository.sameNameAtCourts(courtIds, name, exceptId);
  if (taken.length) {
    throw new ConflictError(`${taken.map((row) => row.courtName).join(", ")} đã có dịch vụ tên "${name.trim()}"`, "SERVICE_NAME_TAKEN");
  }
}

export const serviceService = {
  ownScope,

  async listCategories() {
    return serviceRepository.listCategories();
  },

  async createCategory(data: CreateServiceCategoryInput) {
    return serviceRepository.createCategory(data);
  },

  async listPartnerServices(partnerId: string, categoryId?: string, search?: string, courtId?: string) {
    return serviceRepository.listPartnerServices(partnerId, categoryId, search, courtId);
  },

  /** A court's menu: full rows for its own counter, the customer view for everyone else. */
  async listServicesForCourt(viewer: ServiceViewer, courtId: string, categoryId?: string) {
    const [services, partnerId] = await Promise.all([
      serviceRepository.listServicesForCourt(courtId, categoryId),
      serviceRepository.courtPartnerId(courtId)
    ]);
    return (await seesInternals(viewer, partnerId, courtId)) ? services : services.map(publicView);
  },

  /** A partner's products on sale, as a customer sees them (the partner's own staff get the full rows). */
  async listPartnerCatalog(viewer: ServiceViewer, partnerId: string, categoryId?: string, search?: string) {
    const services = await serviceRepository.listPartnerServices(partnerId, categoryId, search);
    if (await seesInternals(viewer, partnerId)) return services;
    return services.filter((service: any) => service.status === "ACTIVE" && service.courtId).map(publicView);
  },

  async getServiceById(viewer: ServiceViewer, id: string) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    return (await seesInternals(viewer, service.partnerId, service.courtId)) ? service : publicView(service);
  },

  async createService(partnerId: string, data: CreateServiceInput) {
    const courtIds = [...new Set(data.courtIds)];
    const courts = await serviceRepository.partnerCourts(partnerId, courtIds);
    if (courts.length !== courtIds.length) throw new ForbiddenError("Chỉ được bán dịch vụ ở sân của bạn");
    await assertNameFree(courtIds, data.name);

    const created = await serviceRepository.createService(partnerId, { ...data, courtIds });
    if (data.imageUrl !== undefined && created.length) {
      await serviceRepository.applyImageToPartnerServices(partnerId, created[0].name, data.imageUrl ?? null);
    }
    return created;
  },

  async updateService(partnerId: string, id: string, data: UpdateServiceInput) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    if (service.partnerId !== partnerId) throw new ForbiddenError("Không có quyền chỉnh sửa dịch vụ này");

    if (data.courtId !== undefined && data.courtId !== service.courtId) {
      if (service.courtId) throw new ValidationError("Dịch vụ đã gắn với một sân; muốn bán ở sân khác hãy tạo dịch vụ mới cho sân đó");
      if (!(await serviceRepository.partnerCourts(partnerId, [data.courtId])).length) throw new ForbiddenError("Chỉ được bán dịch vụ ở sân của bạn");
    }
    const courtId = data.courtId ?? service.courtId;
    const name = data.name ?? service.name;
    if (courtId && (data.name !== undefined || data.courtId !== undefined)) await assertNameFree([courtId], name, id);

    const updated = await serviceRepository.updateService(id, { ...data, courtId: data.courtId === service.courtId ? undefined : data.courtId });
    // The picture is shared by every court's row for this product; the rest stays per court.
    if (data.imageUrl !== undefined) {
      await serviceRepository.applyImageToPartnerServices(partnerId, updated?.name ?? service.name, data.imageUrl ?? null);
    }
    return updated;
  },

  /** Deletes a product nobody used yet; one with sales or stock history only stops being sold. */
  async deleteService(partnerId: string, id: string) {
    const service = await serviceRepository.findServiceById(id);
    if (!service) throw new NotFoundError("Dịch vụ không tồn tại");
    if (service.partnerId !== partnerId) throw new ForbiddenError("Không có quyền xóa dịch vụ này");
    return serviceRepository.deleteOrRetireService(id);
  }
};
