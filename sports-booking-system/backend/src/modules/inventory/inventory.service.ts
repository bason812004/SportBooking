import { ValidationError } from "../../shared/errors/AppError.js";
import { inventoryRepository } from "./inventory.repository.js";
import type { AdjustStockInput, CreatePurchaseOrderInput, CreateSupplierInput } from "./inventory.types.js";

export const inventoryService = {
  async getInventorySummary(partnerId: string) {
    return inventoryRepository.getInventorySummary(partnerId);
  },

  async adjustStock(partnerId: string, data: AdjustStockInput) {
    if (data.quantity < 0) throw new ValidationError("Số lượng không được âm");
    return inventoryRepository.adjustStock(partnerId, data);
  },

  async getTransactions(partnerId: string, limit?: number) {
    return inventoryRepository.getTransactions(partnerId, limit);
  },

  async listSuppliers(partnerId: string) {
    return inventoryRepository.listSuppliers(partnerId);
  },

  async createSupplier(partnerId: string, data: CreateSupplierInput) {
    if (!data.name?.trim()) throw new ValidationError("Tên nhà cung cấp không được để trống");
    return inventoryRepository.createSupplier(partnerId, data);
  },

  async createPurchaseOrder(partnerId: string, data: CreatePurchaseOrderInput) {
    if (!data.items || data.items.length === 0) {
      throw new ValidationError("Đơn nhập hàng phải có ít nhất 1 sản phẩm");
    }
    return inventoryRepository.createPurchaseOrder(partnerId, data);
  },

  async listPurchaseOrders(partnerId: string) {
    return inventoryRepository.listPurchaseOrders(partnerId);
  }
};
