import { prisma } from "../../config/db.js";

export const userRepository = {
  me(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  updateMe(id: string, data: { fullName?: string; phone?: string; avatarUrl?: string }) {
    return prisma.user.update({ where: { id }, data });
  }
};
