import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../config/db.js";

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { partnerProfile: true }
    });
  },

  createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  createPartner(input: {
    user: Omit<Prisma.UserCreateInput, "role">;
    businessName: string;
    address: string;
    verificationDocumentUrl?: string;
  }) {
    return prisma.user.create({
      data: {
        ...input.user,
        role: "PARTNER" as UserRole,
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

  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  }
};
