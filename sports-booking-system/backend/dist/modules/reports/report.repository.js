import { prisma } from "../../config/db.js";
export const reportRepository = {
    create(data) {
        return prisma.report.create({ data });
    }
};
