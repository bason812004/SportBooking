import { prisma } from "../../config/db.js";
export const userRepository = {
    me(id) {
        return prisma.user.findUnique({ where: { id } });
    },
    updateMe(id, data) {
        return prisma.user.update({ where: { id }, data });
    }
};
