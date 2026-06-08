import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AccountStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { AuthError, ConflictError, NotFoundError } from "../../shared/errors/AppError.js";
import { omitPassword } from "../../shared/utils/response.js";
import { authRepository } from "./auth.repository.js";
function signToken(user) {
    return jwt.sign({ role: user.role }, env.JWT_SECRET, {
        subject: user.id,
        expiresIn: env.JWT_EXPIRES_IN
    });
}
export const authService = {
    async register(input) {
        const existing = await authRepository.findByEmail(input.email);
        if (existing)
            throw new ConflictError("Email da duoc su dung", "EMAIL_EXISTS");
        const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
        const user = await authRepository.createUser({
            fullName: input.fullName,
            email: input.email,
            phone: input.phone,
            passwordHash,
            role: "USER"
        });
        return { user: omitPassword(user), token: signToken(user) };
    },
    async registerPartner(input) {
        const existing = await authRepository.findByEmail(input.email);
        if (existing)
            throw new ConflictError("Email da duoc su dung", "EMAIL_EXISTS");
        const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
        const user = await authRepository.createPartner({
            user: {
                fullName: input.fullName,
                email: input.email,
                phone: input.phone,
                passwordHash
            },
            businessName: input.businessName,
            address: input.address,
            verificationDocumentUrl: input.verificationDocumentUrl
        });
        return { user: omitPassword(user), token: signToken(user) };
    },
    async login(input) {
        const user = await authRepository.findByEmail(input.email);
        if (!user)
            throw new AuthError("Email hoac mat khau khong dung");
        if (user.status === AccountStatus.LOCKED)
            throw new AuthError("Tai khoan dang bi khoa");
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid)
            throw new AuthError("Email hoac mat khau khong dung");
        return { user: omitPassword(user), token: signToken(user) };
    },
    async me(userId) {
        const user = await authRepository.findById(userId);
        if (!user)
            throw new NotFoundError("Khong tim thay tai khoan");
        return omitPassword(user);
    },
    async changePassword(userId, currentPassword, newPassword) {
        const user = await authRepository.findById(userId);
        if (!user)
            throw new NotFoundError("Khong tim thay tai khoan");
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid)
            throw new AuthError("Mat khau hien tai khong dung");
        await authRepository.updatePassword(userId, await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS));
        return { message: "Doi mat khau thanh cong" };
    }
};
