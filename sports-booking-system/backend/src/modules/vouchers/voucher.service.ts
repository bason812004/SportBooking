import { NotFoundError } from "../../shared/errors/AppError.js";
import { voucherRepository } from "./voucher.repository.js";

export const voucherService = {
  list() {
    return voucherRepository.listActive();
  },

  async detail(id: string) {
    const [voucher] = await voucherRepository.findActiveById(id);
    if (!voucher) throw new NotFoundError("Khong tim thay voucher");
    return voucher;
  }
};
