import { NotFoundError } from "../../shared/errors/AppError.js";
import { omitPassword } from "../../shared/utils/response.js";
import { bookingService } from "../bookings/booking.service.js";
import { userRepository } from "./user.repository.js";

export const userService = {
  async me(userId: string) {
    const user = await userRepository.me(userId);
    if (!user) throw new NotFoundError("Khong tim thay tai khoan");
    return omitPassword(user);
  },
  async updateMe(userId: string, data: { fullName?: string; phone?: string; avatarUrl?: string }) {
    const user = await userRepository.updateMe(userId, data);
    return omitPassword(user);
  },
  bookings(userId: string, query: { page?: string; limit?: string }) {
    return bookingService.listForUser(userId, query);
  },
  bookingDetail(userId: string, bookingId: string) {
    return bookingService.getForUser(userId, bookingId);
  },
  cancelBooking(userId: string, bookingId: string, cancelReason?: string) {
    return bookingService.cancel(userId, bookingId, cancelReason);
  }
};
