/**
 * Seed data cho he thong:
 * - 5 Platform Voucher (WELCOME50, SPORT10, WEEKEND15, NIGHT30, SUMMER20)
 * - Partner Wallet cho moi Partner
 * - Settlement mau (chi khi co paid bookings)
 * - Analytics Events mau
 *
 * Idempotent: check truoc khi insert.
 *
 * Chay: npx tsx prisma/seed.ts
 * hoac:  npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLATFORM_VOUCHERS = [
  {
    code: "WELCOME50",
    title: "Chào mừng thành viên mới",
    description: "Mã giảm giá 50.000 VND cho đơn hàng từ 300.000 VND.",
    discountType: "FIXED_AMOUNT" as const,
    discountValue: 50000,
    maxDiscountAmount: null,
    minBookingAmount: 300000,
    usageLimit: 1000,
    daysValid: 30,
  },
  {
    code: "SPORT10",
    title: "Giảm 10% cho đơn hàng",
    description: "Mã giảm giá 10% (tối đa 100.000 VND) cho đơn hàng từ 500.000 VND.",
    discountType: "PERCENTAGE" as const,
    discountValue: 10,
    maxDiscountAmount: 100000,
    minBookingAmount: 500000,
    usageLimit: 500,
    daysValid: 90,
  },
  {
    code: "WEEKEND15",
    title: "Giảm 15% cuối tuần",
    description: "Mã giảm giá 15% (tối đa 150.000 VND) chỉ áp dụng cuối tuần.",
    discountType: "PERCENTAGE" as const,
    discountValue: 15,
    maxDiscountAmount: 150000,
    minBookingAmount: 0,
    usageLimit: 300,
    daysValid: 180,
  },
  {
    code: "NIGHT30",
    title: "Giảm 30.000 VND ca đêm",
    description: "Mã giảm giá 30.000 VND cho tất cả các đơn hàng.",
    discountType: "FIXED_AMOUNT" as const,
    discountValue: 30000,
    maxDiscountAmount: null,
    minBookingAmount: 0,
    usageLimit: 200,
    daysValid: 365,
  },
  {
    code: "SUMMER20",
    title: "Khuyến mãi hè 2026 - Giảm 20%",
    description: "Mã giảm giá 20% (tối đa 200.000 VND) cho đơn hàng từ 800.000 VND.",
    discountType: "PERCENTAGE" as const,
    discountValue: 20,
    maxDiscountAmount: 200000,
    minBookingAmount: 800000,
    usageLimit: 1000,
    daysValid: 365,
  },
];

async function seedPlatformVouchers() {
  console.log("[seed] Seeding platform vouchers...");
  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const v of PLATFORM_VOUCHERS) {
    const existing = await prisma.voucher.findUnique({ where: { code: v.code } });
    if (existing) {
      skipped++;
      console.log(`  - ${v.code} da ton tai, skip`);
      continue;
    }
    const startDate = now;
    const endDate = new Date(now.getTime() + v.daysValid * 24 * 60 * 60 * 1000);
    await prisma.voucher.create({
      data: {
        partnerId: null,
        courtId: null,
        code: v.code,
        title: v.title,
        description: v.description,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscountAmount: v.maxDiscountAmount,
        minBookingAmount: v.minBookingAmount,
        usageLimit: v.usageLimit,
        usedCount: 0,
        startDate,
        endDate,
        status: "ACTIVE",
        fundedBy: "PLATFORM",
        partnerFundingPercent: 0,
        platformFundingPercent: 100,
      },
    });
    created++;
    console.log(`  + ${v.code} (${v.title})`);
  }

  const total = await prisma.voucher.count({ where: { fundedBy: "PLATFORM" } });
  console.log(`[seed] Platform vouchers: ${created} moi, ${skipped} da ton tai, tong ${total} vouchers`);
}

async function seedPartnerWallets() {
  console.log("[seed] Seeding partner wallets...");
  const partners = await prisma.partnerProfile.findMany({ select: { id: true, businessName: true } });
  let created = 0;
  let skipped = 0;

  for (const p of partners) {
    const existing = await prisma.partnerWallet.findUnique({ where: { partnerId: p.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.partnerWallet.create({
      data: {
        partnerId: p.id,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        currency: "VND",
      },
    });
    created++;
    console.log(`  + Wallet cho ${p.businessName}`);
  }
  console.log(`[seed] Partner wallets: ${created} moi, ${skipped} da ton tai`);
}

async function seedAnalyticsEvents() {
  console.log("[seed] Seeding analytics events...");
  const count = await prisma.analyticsEvent.count();
  if (count > 0) {
    console.log(`[seed] Analytics events: da co ${count} records, skip`);
    return;
  }

  const courts = await prisma.court.findMany({ take: 5, select: { id: true } });
  if (courts.length === 0) {
    console.log("[seed] Khong co court de tao analytics");
    return;
  }

  const events = [];
  const types = ["COURT_VIEWED", "COURT_SEARCHED", "DYNAMIC_PRICE_VIEWED"] as const;
  for (let i = 0; i < 20; i++) {
    const court = courts[i % courts.length];
    events.push({
      eventType: types[i % types.length],
      courtId: court.id,
      userId: null,
      partnerId: null,
      metadataJson: { source: "seed" },
    });
  }
  await prisma.analyticsEvent.createMany({ data: events });
  console.log(`[seed] Analytics events: ${events.length} moi`);
}

async function main() {
  console.log("=== Seed started ===");
  try {
    await seedPlatformVouchers();
    await seedPartnerWallets();
    await seedAnalyticsEvents();
    console.log("=== Seed completed ===");
  } catch (err) {
    console.error("[seed] ERROR:", err);
    throw err;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });