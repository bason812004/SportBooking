import { NotFoundError } from "../../shared/errors/AppError.js";
import { omitPassword } from "../../shared/utils/response.js";
import { bookingService } from "../bookings/booking.service.js";
import { userRepository } from "./user.repository.js";
export const userService = {
    async me(userId) {
        const user = await userRepository.me(userId);
        if (!user)
            throw new NotFoundError("Khong tim thay tai khoan");
        return omitPassword(user);
    },
    async updateMe(userId, data) {
        const user = await userRepository.updateMe(userId, data);
        return omitPassword(user);
    },
    bookings(userId, query) {
        return bookingService.listForUser(userId, query);
    }
};
