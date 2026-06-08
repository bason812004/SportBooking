import { prisma } from "../../config/db.js";
export const categoryRepository = {
    list(includeInactive = false) {
        return prisma.courtCategory.findMany({
            where: includeInactive ? undefined : { status: "ACTIVE" },
            orderBy: { name: "asc" }
        });
    }
};
