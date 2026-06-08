import type { UserRole } from "@prisma/client";

export type TokenPayload = {
  sub: string;
  role: UserRole;
};
