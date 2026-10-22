import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cashierApi, type ActiveBookingService, type CashierBookingDetail } from "../api/cashierApi";
import type { ServiceItem } from "../../services/api/serviceApi";

type CartEntry = { service: ServiceItem; quantity: number };

/** The catalog id a booking line points at — this is what `BookingServiceSelector` looks up by. */
function lineServiceId(line: ActiveBookingService) {
  return line.serviceId || line.courtServiceId || line.id;
}

/**
 * `BookingServiceSelector` only reads `price` off the service, but the cart entry is typed as a
 * full `ServiceItem`, so fill the rest from the booking line with harmless defaults.
 */
function lineToServiceItem(line: ActiveBookingService): ServiceItem {
  return {
    id: lineServiceId(line),
    partnerId: "",
    name: line.service?.name ?? "Dịch vụ",
    type: line.service?.type ?? "PRODUCT",
    price: Number(line.unitPrice || line.price || 0),
    costPrice: 0,
    unit: line.service?.unit ?? "đơn vị",
    status: "ACTIVE",
    trackInventory: false
  };
}

export const liveBookingServicesKey = (bookingId: string) => ["cashier-booking-detail", bookingId];

/**
 * Server-backed counterpart of the local walk-in cart in `useWalkInBooking`: same shape
 * (`selectedServices` / `updateQuantity` / `clearServices`) so it can drive the very same
 * `BookingServiceSelector`, but every change is written straight to an existing booking.
 */
export function useLiveBookingServices(bookingId: string | null, onChanged?: () => void) {
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: liveBookingServicesKey(bookingId ?? ""),
    queryFn: () => cashierApi.getBookingDetail(bookingId!),
    enabled: Boolean(bookingId),
    staleTime: 10_000
  });

  const detail = detailQuery.data ?? null;

  // Optimistic overlay: the quantity the staff last asked for, shown immediately while the
  // (slow) write is still in flight.
  const [optimistic, setOptimistic] = useState<Map<string, CartEntry>>(new Map());

  // Latest server state + the quantity each service is *heading towards*, read inside the
  // per-service worker below without going through React state.
  const detailRef = useRef<CashierBookingDetail | null>(null);
  detailRef.current = detail;
  const desiredRef = useRef(new Map<string, number>());
  const busyRef = useRef(new Set<string>());

  const serverQuantity = useCallback((serviceId: string) => {
    const line = detailRef.current?.activeServices?.find((item) => lineServiceId(item) === serviceId);
    return line ? Number(line.quantity) : 0;
  }, []);

  const applyTotals = useCallback(
    (totals: CashierBookingDetail) => {
      if (!bookingId) return;
      detailRef.current = totals;
      queryClient.setQueryData(liveBookingServicesKey(bookingId), totals);
    },
    [bookingId, queryClient]
  );

  const clearOptimistic = useCallback((serviceId: string) => {
    setOptimistic((current) => {
      // A click that landed while we were draining owns the overlay now — leave it alone.
      if (!current.has(serviceId) || desiredRef.current.has(serviceId)) return current;
      const next = new Map(current);
      next.delete(serviceId);
      return next;
    });
  }, []);

  /**
   * Drains the pending target for one service. Each service has at most one request in flight:
   * rapid +/- clicks collapse into the latest target instead of racing each other, which matters
   * because a single write round-trips through a Postgres transaction and can take seconds.
   */
  const drain = useCallback(
    async (serviceId: string) => {
      if (!bookingId || busyRef.current.has(serviceId)) return;
      busyRef.current.add(serviceId);
      try {
        for (;;) {
          const target = desiredRef.current.get(serviceId);
          if (target === undefined) break;
          desiredRef.current.delete(serviceId);

          const current = serverQuantity(serviceId);
          if (target === current) continue;

          const response =
            target <= 0
              ? await cashierApi.removeServiceFromBooking(bookingId, serviceId)
              : current > 0
                ? await cashierApi.updateServiceQuantity(bookingId, serviceId, target)
                : await cashierApi.addServiceToBooking(bookingId, serviceId, target);

          applyTotals(response.totals);
          onChanged?.();
        }
      } catch (error: any) {
        desiredRef.current.delete(serviceId);
        const reason = error?.response?.data?.message || error?.message || "Không cập nhật được dịch vụ";
        // The server states exactly why (out of stock, service inactive, booking status...), and a
        // default-length toast is easy to miss on a slow connection where the failure lands late.
        console.error(`[cashier] booking ${bookingId} · service ${serviceId} failed:`, reason, error);
        toast.error(reason, { duration: 8000 });
        await detailQuery.refetch();
      } finally {
        busyRef.current.delete(serviceId);
        clearOptimistic(serviceId);
      }
    },
    [bookingId, serverQuantity, applyTotals, onChanged, detailQuery, clearOptimistic]
  );

  const updateQuantity = useCallback(
    (service: ServiceItem, quantity: number) => {
      if (!bookingId) return;
      const next = Math.max(0, Math.trunc(quantity));
      desiredRef.current.set(service.id, next);
      setOptimistic((current) => new Map(current).set(service.id, { service, quantity: next }));
      void drain(service.id);
    },
    [bookingId, drain]
  );

  const clearServices = useCallback(() => {
    for (const line of detailRef.current?.activeServices ?? []) {
      updateQuantity(lineToServiceItem(line), 0);
    }
  }, [updateQuantity]);

  const selectedServices = useMemo(() => {
    const map = new Map<string, CartEntry>();
    for (const line of detail?.activeServices ?? []) {
      map.set(lineServiceId(line), { service: lineToServiceItem(line), quantity: Number(line.quantity) });
    }
    for (const [serviceId, entry] of optimistic) {
      if (entry.quantity <= 0) map.delete(serviceId);
      else map.set(serviceId, entry);
    }
    return map;
  }, [detail, optimistic]);

  return {
    detail,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    selectedServices,
    updateQuantity,
    clearServices
  };
}
