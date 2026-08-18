import { prisma } from "../../config/db.js";
import { NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { durationHours } from "../../shared/utils/time.js";
import { dynamicPricingService } from "../dynamic-pricing/dynamicPricing.service.js";

export type PricingSlotInput = {
  courtId?: string;
  courtSurfaceId?: string;
  courtSubId?: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type PricingServiceInput = {
  serviceId: string;
  quantity: number;
};

export type CalculateBookingPriceInput = {
  courtId: string;
  slots: PricingSlotInput[];
  services?: PricingServiceInput[];
  voucherId?: string;
  voucherCode?: string;
};

export type PricedSlotItem = {
  courtId: string;
  courtSurfaceId: string | null;
  courtSurfaceName: string;
  date: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  dynamicAdjustment: number;
  finalPrice: number;
  isAvailable: boolean;
};

export type PricedServiceLine = {
  serviceId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
};

export type CalculatedBookingPrice = {
  court: {
    id: string;
    name: string;
    address: string;
    imageUrl: string | null;
  };
  courtSubtotal: number;
  servicesSubtotal: number;
  subtotal: number;
  voucherDiscountAmount: number;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositPercent: number;
  requiresDeposit: boolean;
  items: PricedSlotItem[];
  services: PricedServiceLine[];
  voucherId: string | null;
  currency: "VND";
};

export function calculateMinimumDeposit(totalAmount: number, depositPercent: number): number {
  if (depositPercent <= 0) return 0;
  return Math.ceil(totalAmount * (depositPercent / 100));
}

export async function calculateBookingPrice(input: CalculateBookingPriceInput): Promise<CalculatedBookingPrice> {
  if (!input.slots || input.slots.length === 0) {
    throw new ValidationError("Danh sách khung giờ không được để trống");
  }

  const court = await prisma.court.findFirst({
    where: { id: input.courtId, approvalStatus: "APPROVED", activeStatus: "ACTIVE" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      surfaces: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }
    }
  });

  if (!court) {
    throw new NotFoundError("Sân không tồn tại hoặc chưa được duyệt");
  }

  const depositPercent = Number(court.deposit_percent ?? 0);
  const requiresDeposit = depositPercent > 0;

  // Prefetch dynamic pricing rules and base prices once
  const prefetchedPricing = await dynamicPricingService.prefetch(input.courtId);
  const surfaceMap = new Map(court.surfaces.map((s) => [s.id, s.name]));
  const defaultSurfaceId = court.surfaces[0]?.id ?? null;
  const defaultSurfaceName = court.surfaces[0]?.name ?? court.name;

  let courtSubtotal = 0;
  const pricedSlots: PricedSlotItem[] = [];

  for (const slot of input.slots) {
    const date = slot.date;
    const startTime = slot.startTime.slice(0, 5);
    const endTime = slot.endTime.slice(0, 5);
    const surfaceId = slot.courtSurfaceId || slot.courtSubId || defaultSurfaceId;
    const surfaceName = surfaceId ? surfaceMap.get(surfaceId) || defaultSurfaceName : defaultSurfaceName;

    // Pure pricing resolution for this date & time slot
    const priceRes = dynamicPricingService.resolveFromPrefetched(prefetchedPricing, {
      date,
      startTime,
      endTime
    });

    const hours = durationHours(startTime, endTime);
    const basePrice = Math.round(priceRes.basePrice * hours);
    const dynamicAdjustment = Math.round(priceRes.dynamicAdjustmentAmount * hours);
    const finalPrice = Math.round(priceRes.finalPrice * hours);

    courtSubtotal += finalPrice;

    pricedSlots.push({
      courtId: input.courtId,
      courtSurfaceId: surfaceId,
      courtSurfaceName: surfaceName,
      date,
      startTime,
      endTime,
      basePrice,
      dynamicAdjustment,
      finalPrice,
      isAvailable: true
    });
  }

  // Calculate Services Subtotal
  const serviceLines: PricedServiceLine[] = [];
  let servicesSubtotal = 0;

  if (input.services && input.services.length > 0) {
    const serviceIds = input.services.map((s) => s.serviceId);
    const dbServices = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
    const courtServices = await prisma.courtService.findMany({ where: { id: { in: serviceIds }, status: "ACTIVE" } });

    const svcMap = new Map<string, { id: string; name: string; price: number }>();
    dbServices.forEach((s) => svcMap.set(s.id, { id: s.id, name: s.name, price: Number(s.price) }));
    courtServices.forEach((s) => svcMap.set(s.id, { id: s.id, name: s.name, price: Number(s.price) }));

    for (const reqSvc of input.services) {
      const found = svcMap.get(reqSvc.serviceId);
      if (!found) {
        throw new ValidationError(`Dịch vụ ${reqSvc.serviceId} không tồn tại`);
      }
      const lineTotal = found.price * reqSvc.quantity;
      servicesSubtotal += lineTotal;
      serviceLines.push({
        serviceId: found.id,
        name: found.name,
        quantity: reqSvc.quantity,
        price: found.price,
        total: lineTotal
      });
    }
  }

  const subtotal = courtSubtotal + servicesSubtotal;
  let voucherDiscountAmount = 0;
  let appliedVoucherId: string | null = null;

  if (input.voucherId || input.voucherCode) {
    const voucher = await prisma.voucher.findFirst({
      where: input.voucherId
        ? { id: input.voucherId }
        : { code: input.voucherCode!.toUpperCase(), status: "ACTIVE" }
    });

    if (voucher && voucher.status === "ACTIVE") {
      appliedVoucherId = voucher.id;
      const minAmount = Number(voucher.minBookingAmount ?? 0);

      if (subtotal >= minAmount) {
        const discountVal = Number(voucher.discountValue);
        const rawDiscount =
          voucher.discountType === "PERCENTAGE"
            ? Math.round((subtotal * discountVal) / 100)
            : discountVal;
        const maxDiscount = voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : Number.POSITIVE_INFINITY;
        voucherDiscountAmount = Math.min(rawDiscount, maxDiscount, subtotal);
      }
    }
  }

  const totalAmount = Math.max(0, subtotal - voucherDiscountAmount);
  const depositAmount = calculateMinimumDeposit(totalAmount, depositPercent);
  const remainingAmount = Math.max(0, totalAmount - depositAmount);

  return {
    court: {
      id: court.id,
      name: court.name,
      address: court.address,
      imageUrl: court.images?.[0]?.imageUrl ?? null
    },
    courtSubtotal,
    servicesSubtotal,
    subtotal,
    voucherDiscountAmount,
    totalAmount,
    depositAmount,
    remainingAmount,
    depositPercent,
    requiresDeposit,
    items: pricedSlots,
    services: serviceLines,
    voucherId: appliedVoucherId,
    currency: "VND"
  };
}
