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

  upsertGoogleUser(input: { email: string; fullName: string; avatarUrl?: string | null; providerId: string }) {
    return prisma.user.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        fullName: input.fullName,
        avatarUrl: input.avatarUrl,
        provider: "GOOGLE",
        providerId: input.providerId,
        emailVerified: true,
        role: "USER"
      },
      update: {
        provider: "GOOGLE",
        providerId: input.providerId,
        emailVerified: true,
        avatarUrl: input.avatarUrl ?? undefined
      }
    });
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
  },

  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true }
    });
  },

  revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
};
