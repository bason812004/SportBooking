import { prisma } from "../../config/db.js";
export const authRepository = {
    findByEmail(email) {
        return prisma.user.findUnique({ where: { email } });
    },
    findById(id) {
        return prisma.user.findUnique({
            where: { id },
            include: { partnerProfile: true }
        });
    },
    createUser(data) {
        return prisma.user.create({ data });
    },
    createPartner(input) {
        return prisma.user.create({
            data: {
                ...input.user,
                role: "PARTNER",
                partnerProfile: {
                    create: {
                        businessName: input.businessName,
                        address: input.address,
                        verificationDocumentUrl: input.verificationDocumentUrl
                    }
                }
            },
            include: { partnerProfile: true }
        });
    },
    updatePassword(id, passwordHash) {
        return prisma.user.update({ where: { id }, data: { passwordHash } });
    }
};
