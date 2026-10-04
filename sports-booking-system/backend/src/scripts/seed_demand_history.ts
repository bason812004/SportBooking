import { prisma } from "../config/db.js";
import { dayTypeFor, toDbDate, vietnamNow } from "../shared/utils/time.js";

/**
 * Seeds demo booking history so demand prediction (rule-based >= 20 bookings,
 * ML >= ML_MIN_HISTORY) has data to work with. Every row uses the
 * `BK-DEMAND-` booking code prefix, so `--clean` removes exactly what this script
 * created and never touches real bookings.
 *
 *   npx tsx src/scripts/seed_demand_history.ts --court=c0003,c0021 --weeks=12
 *   npx tsx src/scripts/seed_demand_history.ts --clean
 *
 * `--court` is required on purpose: Windows PowerShell drops the `--` in
 * `npm run seed:demand-history -- --court=...`, and a silent default court list
 * would then write demo rows to courts nobody chose.
 */

const CODE_PREFIX = "BK-DEMAND-";
const DEMO_USER_EMAIL = "demand.demo@sportbooking.local";
const FALLBACK_PRICE = 100000;
const CANCEL_RATE = 0.08;
const BATCH_SIZE = 500;

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

/** Deterministic PRNG so re-running the seed produces the same history. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function addDays(date: string, days: number) {
  const dt = new Date(`${date}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function hourOf(time: Date) {
  return time.getUTCHours();
}

function hhmm(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function bookingProbability(hour: number, isWeekend: boolean) {
  let probability = 0.15;
  if (hour >= 17 && hour < 21) probability += 0.45;
  if (hour >= 5 && hour < 7) probability += 0.2;
  if (isWeekend) probability += 0.15;
  return Math.min(probability, 0.9);
}

type PriceRow = { dayType: string; startTime: Date; endTime: Date; price: number };

function priceFor(rows: PriceRow[], dayType: string, hour: number) {
  const row = rows.find((item) => item.dayType === dayType && hourOf(item.startTime) <= hour && hour < (hourOf(item.endTime) || 24));
  return row ? row.price : null;
}

async function clean() {
  const result = await prisma.booking.deleteMany({ where: { bookingCode: { startsWith: CODE_PREFIX } } });
  console.log(`Đã xoá ${result.count} booking demo (${CODE_PREFIX}*).`);
}

async function seed() {
  const weeks = Math.max(1, Number(arg("weeks") ?? 12));
  // PowerShell turns `--court=a,b` into "a b", so accept commas and spaces.
  const courtIds = arg("court")?.split(/[,\s]+/).filter(Boolean) ?? [];
  if (courtIds.length === 0) {
    throw new Error("Thiếu --court. Ví dụ: npx tsx src/scripts/seed_demand_history.ts --court=c0003,c0021 --weeks=12");
  }

  const courts = await prisma.court.findMany({
    where: { id: { in: courtIds } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      openingTime: true,
      closingTime: true,
      basePrices: { select: { dayType: true, startTime: true, endTime: true, basePrice: true } },
      prices: { select: { dayType: true, startTime: true, endTime: true, price: true } }
    }
  });
  const missing = courtIds.filter((id) => !courts.some((court) => court.id === id));
  if (missing.length > 0) throw new Error(`Không tìm thấy sân: ${missing.join(", ")}`);

  const demoUser =
    (await prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } })) ??
    (await prisma.user.create({ data: { email: DEMO_USER_EMAIL, fullName: "Khách demo dự đoán nhu cầu", role: "USER" } }));

  const today = vietnamNow().date;
  const firstDate = addDays(today, -weeks * 7);
  const lastDate = addDays(today, -1);

  for (const court of courts) {
    const prices: PriceRow[] = [
      ...court.basePrices.map((row) => ({ dayType: row.dayType, startTime: row.startTime, endTime: row.endTime, price: Number(row.basePrice) })),
      ...court.prices.map((row) => ({ dayType: row.dayType, startTime: row.startTime, endTime: row.endTime, price: Number(row.price) }))
    ];

    // Hours already taken by real bookings are skipped so demo rows never overlap them.
    const realBookings = await prisma.booking.findMany({
      where: {
        courtId: court.id,
        bookingDate: { gte: toDbDate(firstDate), lte: toDbDate(lastDate) },
        NOT: { bookingCode: { startsWith: CODE_PREFIX } }
      },
      select: { bookingDate: true, startTime: true, endTime: true }
    });
    const takenHours = new Set<string>();
    for (const booking of realBookings) {
      const date = booking.bookingDate.toISOString().slice(0, 10);
      for (let hour = hourOf(booking.startTime); hour < (hourOf(booking.endTime) || 24); hour += 1) takenHours.add(`${date}|${hour}`);
    }

    const openHour = hourOf(court.openingTime);
    const closeHour = hourOf(court.closingTime) || 24;
    const random = mulberry32(hashString(court.id));
    const rows = [];

    for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
      const dayType = dayTypeFor(date);
      const isWeekend = dayType === "WEEKEND";
      for (let hour = openHour; hour < closeHour; hour += 1) {
        const roll = random();
        const cancelRoll = random();
        if (takenHours.has(`${date}|${hour}`) || roll >= bookingProbability(hour, isWeekend)) continue;

        const code = `${CODE_PREFIX}${court.id}-${date.replace(/-/g, "")}${String(hour).padStart(2, "0")}`;
        if (code.length > 30) throw new Error(`Mã booking quá dài cho sân ${court.id}: ${code}`);

        const price = priceFor(prices, dayType, hour) ?? FALLBACK_PRICE;
        const cancelled = cancelRoll < CANCEL_RATE;
        // Created the day before play so dashboards counting "bookings created today" are not inflated.
        const createdAt = new Date(`${addDays(date, -1)}T10:00:00+07:00`);

        rows.push({
          bookingCode: code,
          userId: demoUser.id,
          courtId: court.id,
          bookingDate: toDbDate(date),
          startTime: new Date(`1970-01-01T${hhmm(hour)}:00.000Z`),
          endTime: new Date(`1970-01-01T${hhmm(hour + 1 === 24 ? 0 : hour + 1)}:00.000Z`),
          totalPrice: price,
          subtotal: price,
          basePrice: price,
          paymentMethod: "CASH" as const,
          paymentStatus: cancelled ? ("UNPAID" as const) : ("PAID" as const),
          bookingStatus: cancelled ? ("CANCELLED" as const) : ("COMPLETED" as const),
          cancelledAt: cancelled ? createdAt : null,
          cancelReason: cancelled ? "Demo: khách huỷ" : null,
          note: "Dữ liệu demo cho dự đoán nhu cầu",
          createdAt,
          updatedAt: createdAt
        });
      }
    }

    let inserted = 0;
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const result = await prisma.booking.createMany({ data: rows.slice(index, index + BATCH_SIZE), skipDuplicates: true });
      inserted += result.count;
    }
    const completed = rows.filter((row) => row.bookingStatus === "COMPLETED").length;
    console.log(
      `${court.id} (${court.name}): tạo ${inserted}/${rows.length} booking demo (${completed} hoàn thành, ${rows.length - completed} huỷ), ${firstDate} → ${lastDate}.`
    );
  }
}

async function main() {
  if (hasFlag("clean")) await clean();
  else await seed();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
