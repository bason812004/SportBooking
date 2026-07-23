import { prisma } from "../../config/db.js";

export const userRepository = {
  async me(id: string) {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      passwordHash: string | null;
      role: string;
      avatarUrl: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>>`
      select
        id,
        full_name as "fullName",
        email,
        phone,
        password_hash as "passwordHash",
        role::text as "role",
        avatar_url as "avatarUrl",
        status::text as "status",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from users
      where id = ${id}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async updateMe(id: string, data: { fullName?: string; phone?: string; avatarUrl?: string }) {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      passwordHash: string | null;
      role: string;
      avatarUrl: string | null;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>>`
      update users
      set
        full_name = coalesce(${data.fullName ?? null}, full_name),
        phone = coalesce(${data.phone ?? null}, phone),
        avatar_url = coalesce(${data.avatarUrl ?? null}, avatar_url),
        updated_at = now()
      where id = ${id}
      returning
        id,
        full_name as "fullName",
        email,
        phone,
        password_hash as "passwordHash",
        role::text as "role",
        avatar_url as "avatarUrl",
        status::text as "status",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    return rows[0] ?? null;
  },

  async updateAvatar(id: string, avatarUrl: string) {
    await prisma.$executeRaw`
      update users set avatar_url = ${avatarUrl}, updated_at = now() where id = ${id}
    `;
  },

  async findByIdForAvatar(id: string) {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      avatarUrl: string | null;
    }>>`
      select
        id,
        full_name as "fullName",
        email,
        role::text as "role",
        avatar_url as "avatarUrl"
      from users
      where id = ${id}
      limit 1
    `;
    return rows[0] ?? null;
  }
};
