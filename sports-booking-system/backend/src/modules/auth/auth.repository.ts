import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "../../config/db.js";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  passwordHash: string | null;
  role: UserRole;
  provider: "LOCAL" | "GOOGLE";
  providerId: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
  status: "ACTIVE" | "LOCKED" | "INACTIVE" | "BLOCKED";
  createdAt: Date;
  updatedAt: Date;
  partnerProfile?: unknown;
};

export type VerificationRow = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  passwordHash: string;
  otpHash: string;
  expiresAt: Date;
  verifiedAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  resendCount: number;
  lastSentAt: Date;
  accountType: "USER" | "PARTNER";
  businessName: string | null;
  address: string | null;
  verificationDocumentUrl: string | null;
};

let authSchemaReady: Promise<void> | null = null;

function ensureAuthSchema() {
  authSchemaReady ??= (async () => {
    await prisma.$executeRawUnsafe(`
      do $$
      begin
        if not exists (select 1 from pg_type where typname = 'auth_provider') then
          create type auth_provider as enum ('LOCAL', 'GOOGLE');
        end if;
      end $$
    `);
    await prisma.$executeRawUnsafe("alter type account_status add value if not exists 'INACTIVE'");
    await prisma.$executeRawUnsafe("alter type account_status add value if not exists 'BLOCKED'");
    await prisma.$executeRawUnsafe("alter table users add column if not exists provider auth_provider not null default 'LOCAL'");
    await prisma.$executeRawUnsafe("alter table users add column if not exists provider_id varchar(160)");
    await prisma.$executeRawUnsafe("alter table users add column if not exists email_verified boolean not null default false");
    await prisma.$executeRawUnsafe("alter table users alter column password_hash drop not null");
    await prisma.$executeRawUnsafe(`
      create table if not exists refresh_tokens (
        id uuid primary key default gen_random_uuid(),
        user_id varchar(20) not null references users(id) on delete cascade,
        token_hash text not null,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      )
    `);
    await prisma.$executeRawUnsafe("alter table refresh_tokens drop constraint if exists refresh_tokens_user_id_fkey");
    await prisma.$executeRawUnsafe("alter table refresh_tokens alter column user_id type varchar(20) using user_id::text");
    await prisma.$executeRawUnsafe("alter table refresh_tokens add constraint refresh_tokens_user_id_fkey foreign key (user_id) references users(id) on delete cascade");
    await prisma.$executeRawUnsafe("create index if not exists idx_refresh_tokens_user_id on refresh_tokens(user_id)");
    await prisma.$executeRawUnsafe("create index if not exists idx_refresh_tokens_token_hash on refresh_tokens(token_hash)");
    await prisma.$executeRawUnsafe("create index if not exists idx_users_provider_provider_id on users(provider, provider_id)");
    await prisma.$executeRawUnsafe(`
      do $$
      begin
        if not exists (select 1 from pg_type where typname = 'verification_purpose') then
          create type verification_purpose as enum ('REGISTER', 'FORGOT_PASSWORD', 'CHANGE_EMAIL');
        end if;
      end $$
    `);
    await prisma.$executeRawUnsafe(`
      create table if not exists email_verification_codes (
        id uuid primary key default gen_random_uuid(),
        email varchar(160) not null,
        full_name varchar(120) not null,
        phone varchar(30),
        password_hash text not null,
        otp_hash text not null,
        purpose verification_purpose not null default 'REGISTER',
        expires_at timestamptz not null,
        verified_at timestamptz,
        attempt_count integer not null default 0,
        max_attempts integer not null default 5,
        resend_count integer not null default 0,
        last_sent_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint uq_email_verification_codes_email_purpose unique (email, purpose)
      )
    `);
    await prisma.$executeRawUnsafe("create index if not exists idx_email_verification_codes_expires_at on email_verification_codes(expires_at)");
    await prisma.$executeRawUnsafe("alter table email_verification_codes add column if not exists account_type varchar(20) not null default 'USER'");
    await prisma.$executeRawUnsafe("alter table email_verification_codes add column if not exists business_name varchar(180)");
    await prisma.$executeRawUnsafe("alter table email_verification_codes add column if not exists address text");
    await prisma.$executeRawUnsafe("alter table email_verification_codes add column if not exists verification_document_url text");
  })();
  return authSchemaReady;
}

const userSelect = Prisma.sql`
  select
    u.id,
    u.full_name as "fullName",
    u.email,
    u.phone,
    u.password_hash as "passwordHash",
    u.role::text as "role",
    coalesce(u.provider::text, 'LOCAL') as "provider",
    u.provider_id as "providerId",
    coalesce(u.email_verified, false) as "emailVerified",
    u.avatar_url as "avatarUrl",
    u.status::text as "status",
    u.created_at as "createdAt",
    u.updated_at as "updatedAt"
  from users u
`;

export const authRepository = {
  async findRegistrationVerification(email: string) {
    await ensureAuthSchema();
    const rows = await prisma.$queryRaw<VerificationRow[]>`
      select id, email, full_name as "fullName", phone, password_hash as "passwordHash",
        otp_hash as "otpHash", expires_at as "expiresAt", verified_at as "verifiedAt",
        attempt_count as "attemptCount", max_attempts as "maxAttempts",
        resend_count as "resendCount", last_sent_at as "lastSentAt",
        account_type as "accountType", business_name as "businessName", address,
        verification_document_url as "verificationDocumentUrl"
      from email_verification_codes
      where lower(email) = lower(${email}) and purpose = 'REGISTER'::verification_purpose
      limit 1
    `;
    return rows[0] ?? null;
  },

  async saveRegistrationVerification(data: {
    email: string;
    fullName: string;
    phone?: string | null;
    passwordHash: string;
    otpHash: string;
    expiresAt: Date;
    resendCount: number;
    accountType?: "USER" | "PARTNER";
    businessName?: string | null;
    address?: string | null;
    verificationDocumentUrl?: string | null;
  }) {
    await ensureAuthSchema();
    const rows = await prisma.$queryRaw<VerificationRow[]>`
      insert into email_verification_codes
        (email, full_name, phone, password_hash, otp_hash, purpose, expires_at, attempt_count, max_attempts, resend_count,
         last_sent_at, account_type, business_name, address, verification_document_url)
      values
        (${data.email}, ${data.fullName}, ${data.phone ?? null}, ${data.passwordHash}, ${data.otpHash},
         'REGISTER'::verification_purpose, ${data.expiresAt}, 0, 5, ${data.resendCount}, now(),
         ${data.accountType ?? "USER"}, ${data.businessName ?? null}, ${data.address ?? null}, ${data.verificationDocumentUrl ?? null})
      on conflict (email, purpose) do update set
        full_name = excluded.full_name,
        phone = excluded.phone,
        password_hash = excluded.password_hash,
        otp_hash = excluded.otp_hash,
        expires_at = excluded.expires_at,
        verified_at = null,
        attempt_count = 0,
        resend_count = excluded.resend_count,
        account_type = excluded.account_type,
        business_name = excluded.business_name,
        address = excluded.address,
        verification_document_url = excluded.verification_document_url,
        last_sent_at = now(),
        updated_at = now()
      returning id, email, full_name as "fullName", phone, password_hash as "passwordHash",
        otp_hash as "otpHash", expires_at as "expiresAt", verified_at as "verifiedAt",
        attempt_count as "attemptCount", max_attempts as "maxAttempts",
        resend_count as "resendCount", last_sent_at as "lastSentAt",
        account_type as "accountType", business_name as "businessName", address,
        verification_document_url as "verificationDocumentUrl"
    `;
    return rows[0];
  },

  async deleteRegistrationVerification(id: string) {
    await ensureAuthSchema();
    return prisma.$executeRaw`delete from email_verification_codes where id = ${id}::uuid`;
  },

  async incrementVerificationAttempt(id: string) {
    await ensureAuthSchema();
    return prisma.$executeRaw`
      update email_verification_codes
      set attempt_count = attempt_count + 1, updated_at = now()
      where id = ${id}::uuid and verified_at is null
    `;
  },

  async createUserFromVerification(id: string) {
    await ensureAuthSchema();
    return prisma.$transaction(async (tx) => {
      const verificationRows = await tx.$queryRaw<VerificationRow[]>`
        update email_verification_codes
        set verified_at = now(), updated_at = now()
        where id = ${id}::uuid
          and verified_at is null
          and expires_at > now()
          and attempt_count < max_attempts
        returning id, email, full_name as "fullName", phone, password_hash as "passwordHash",
          otp_hash as "otpHash", expires_at as "expiresAt", verified_at as "verifiedAt",
          attempt_count as "attemptCount", max_attempts as "maxAttempts",
          resend_count as "resendCount", last_sent_at as "lastSentAt",
          account_type as "accountType", business_name as "businessName", address,
          verification_document_url as "verificationDocumentUrl"
      `;
      const verification = verificationRows[0];
      if (!verification) return null;
      const existingUsers = await tx.$queryRaw<UserRow[]>`
        select id, full_name as "fullName", email, phone, password_hash as "passwordHash",
          role::text as "role", provider::text as "provider", provider_id as "providerId",
          email_verified as "emailVerified", avatar_url as "avatarUrl", status::text as "status",
          created_at as "createdAt", updated_at as "updatedAt"
        from users where lower(email) = lower(${verification.email}) limit 1
      `;
      const existingUser = existingUsers[0];
      if (existingUser && existingUser.role !== verification.accountType) {
        throw new Error("Registration account type does not match the existing account");
      }
      const users = existingUser
        ? await tx.$queryRaw<UserRow[]>`
            update users set full_name = ${verification.fullName}, phone = ${verification.phone},
              password_hash = ${verification.passwordHash}, provider = 'LOCAL'::auth_provider,
              email_verified = true, updated_at = now()
            where id = ${existingUser.id}
            returning id, full_name as "fullName", email, phone, password_hash as "passwordHash",
              role::text as "role", provider::text as "provider", provider_id as "providerId",
              email_verified as "emailVerified", avatar_url as "avatarUrl", status::text as "status",
              created_at as "createdAt", updated_at as "updatedAt"
          `
        : await tx.$queryRaw<UserRow[]>`
            insert into users (full_name, email, phone, password_hash, role, provider, email_verified, status)
            values (${verification.fullName}, ${verification.email}, ${verification.phone}, ${verification.passwordHash},
              ${verification.accountType}::user_role, 'LOCAL'::auth_provider, true, 'ACTIVE'::account_status)
            returning id, full_name as "fullName", email, phone, password_hash as "passwordHash",
              role::text as "role", provider::text as "provider", provider_id as "providerId",
              email_verified as "emailVerified", avatar_url as "avatarUrl", status::text as "status",
              created_at as "createdAt", updated_at as "updatedAt"
          `;
      const user = users[0];
      if (verification.accountType === "PARTNER") {
        const profiles = await tx.$queryRaw<Array<{ id: string; businessName: string; approvalStatus: string }>>`
          insert into partner_profiles (user_id, business_name, address, verification_document_url)
          values (${user.id}, ${verification.businessName!}, ${verification.address!}, ${verification.verificationDocumentUrl})
          on conflict (user_id) do update set business_name = excluded.business_name,
            address = excluded.address, verification_document_url = excluded.verification_document_url,
            updated_at = now()
          returning id, business_name as "businessName", approval_status::text as "approvalStatus"
        `;
        return { ...user, partnerProfile: profiles[0] };
      }
      return user;
    });
  },
  async findByEmail(email: string) {
    await ensureAuthSchema();
    const rows = await prisma.$queryRaw<UserRow[]>`
      ${userSelect}
      where lower(u.email) = lower(${email})
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findById(id: string) {
    await ensureAuthSchema();
    const rows = await prisma.$queryRaw<UserRow[]>`
      select
        u.id,
        u.full_name as "fullName",
        u.email,
        u.phone,
        u.password_hash as "passwordHash",
        u.role::text as "role",
        coalesce(u.provider::text, 'LOCAL') as "provider",
        u.provider_id as "providerId",
        coalesce(u.email_verified, false) as "emailVerified",
        u.avatar_url as "avatarUrl",
        u.status::text as "status",
        u.created_at as "createdAt",
        u.updated_at as "updatedAt",
        case
          when pp.id is null then null
          else json_build_object(
            'id', pp.id,
            'businessName', pp.business_name,
            'approvalStatus', pp.approval_status::text
          )
        end as "partnerProfile"
      from users u
      left join partner_profiles pp on pp.user_id = u.id
      where u.id = ${id}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async createUser(data: { fullName: string; email: string; phone?: string | null; passwordHash: string; role: "USER"; provider?: "LOCAL" }) {
    await ensureAuthSchema();
    const rows = await prisma.$queryRaw<UserRow[]>`
      insert into users (full_name, email, phone, password_hash, role, provider, email_verified)
      values (${data.fullName}, ${data.email}, ${data.phone ?? null}, ${data.passwordHash}, ${data.role}::user_role, 'LOCAL'::auth_provider, false)
      returning
        id,
        full_name as "fullName",
        email,
        phone,
        password_hash as "passwordHash",
        role::text as "role",
        provider::text as "provider",
        provider_id as "providerId",
        email_verified as "emailVerified",
        avatar_url as "avatarUrl",
        status::text as "status",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    return rows[0];
  },

  async upsertGoogleUser(input: { email: string; fullName: string; avatarUrl?: string | null; providerId: string; existingUserId?: string }) {
    await ensureAuthSchema();
    if (input.existingUserId) {
      const linked = await prisma.$queryRaw<UserRow[]>`
        update users set
          provider = 'GOOGLE'::auth_provider,
          provider_id = ${input.providerId},
          email_verified = true,
          avatar_url = coalesce(${input.avatarUrl ?? null}, avatar_url),
          updated_at = now()
        where id = ${input.existingUserId}
        returning id, full_name as "fullName", email, phone, password_hash as "passwordHash",
          role::text as "role", provider::text as "provider", provider_id as "providerId",
          email_verified as "emailVerified", avatar_url as "avatarUrl", status::text as "status",
          created_at as "createdAt", updated_at as "updatedAt"
      `;
      return linked[0];
    }
    const rows = await prisma.$queryRaw<UserRow[]>`
      insert into users (full_name, email, password_hash, role, provider, provider_id, email_verified, avatar_url)
      values (${input.fullName}, ${input.email}, null, 'USER'::user_role, 'GOOGLE'::auth_provider, ${input.providerId}, true, ${input.avatarUrl ?? null})
      on conflict (email) do update set
        provider = 'GOOGLE'::auth_provider,
        provider_id = excluded.provider_id,
        email_verified = true,
        avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
        updated_at = now()
      returning
        id,
        full_name as "fullName",
        email,
        phone,
        password_hash as "passwordHash",
        role::text as "role",
        provider::text as "provider",
        provider_id as "providerId",
        email_verified as "emailVerified",
        avatar_url as "avatarUrl",
        status::text as "status",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    return rows[0];
  },

  async createPartner(input: {
    user: { fullName: string; email: string; phone?: string | null; passwordHash: string };
    businessName: string;
    address: string;
    verificationDocumentUrl?: string;
  }) {
    await ensureAuthSchema();
    return prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<UserRow[]>`
        insert into users (full_name, email, phone, password_hash, role, provider, email_verified)
        values (${input.user.fullName}, ${input.user.email}, ${input.user.phone ?? null}, ${input.user.passwordHash}, 'PARTNER'::user_role, 'LOCAL'::auth_provider, false)
        returning
          id,
          full_name as "fullName",
          email,
          phone,
          password_hash as "passwordHash",
          role::text as "role",
          provider::text as "provider",
          provider_id as "providerId",
          email_verified as "emailVerified",
          avatar_url as "avatarUrl",
          status::text as "status",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      const user = users[0];
      const profiles = await tx.$queryRaw<Array<{ id: string; businessName: string; approvalStatus: string }>>`
        insert into partner_profiles (user_id, business_name, address, verification_document_url)
        values (${user.id}, ${input.businessName}, ${input.address}, ${input.verificationDocumentUrl ?? null})
        returning id, business_name as "businessName", approval_status::text as "approvalStatus"
      `;
      return { ...user, partnerProfile: profiles[0] };
    });
  },

  async updatePassword(id: string, passwordHash: string) {
    await ensureAuthSchema();
    return prisma.$executeRaw`
      update users
      set password_hash = ${passwordHash}, provider = 'LOCAL'::auth_provider, updated_at = now()
      where id = ${id}
    `;
  },

  async createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    await ensureAuthSchema();
    return prisma.$executeRaw`
      insert into refresh_tokens (user_id, token_hash, expires_at)
      values (${data.userId}, ${data.tokenHash}, ${data.expiresAt})
    `;
  },

  async findRefreshToken(tokenHash: string) {
    await ensureAuthSchema();
    const rows = await prisma.$queryRaw<Array<{ userId: string; user: UserRow }>>`
      select
        rt.user_id as "userId",
        json_build_object(
          'id', u.id,
          'fullName', u.full_name,
          'email', u.email,
          'phone', u.phone,
          'passwordHash', u.password_hash,
          'role', u.role::text,
          'provider', coalesce(u.provider::text, 'LOCAL'),
          'providerId', u.provider_id,
          'emailVerified', coalesce(u.email_verified, false),
          'avatarUrl', u.avatar_url,
          'status', u.status::text,
          'createdAt', u.created_at,
          'updatedAt', u.updated_at
        ) as "user"
      from refresh_tokens rt
      join users u on u.id = rt.user_id
      where rt.token_hash = ${tokenHash}
        and rt.revoked_at is null
        and rt.expires_at > now()
      limit 1
    `;
    return rows[0] ?? null;
  },

  async revokeRefreshToken(tokenHash: string) {
    await ensureAuthSchema();
    return prisma.$executeRaw`
      update refresh_tokens
      set revoked_at = now()
      where token_hash = ${tokenHash}
        and revoked_at is null
    `;
  }
};
