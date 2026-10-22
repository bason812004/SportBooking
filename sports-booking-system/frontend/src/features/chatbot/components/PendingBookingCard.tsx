import { useTranslation } from "react-i18next";
import type { PendingBookingSummary } from "../api/chatbotApi";
import { useConfirmPendingBooking } from "../hooks/usePendingBooking";

const PAYMENT_LABEL: Record<PendingBookingSummary["paymentType"], string> = {
  DEPOSIT: "Đặt cọc",
  FULL_PAYMENT: "Thanh toán toàn bộ",
  PAY_AT_COURT: "Thanh toán tại sân"
};

export function PendingBookingCard({
  pendingBooking,
  onDismiss
}: {
  pendingBooking: PendingBookingSummary;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("chat");
  const confirmMutation = useConfirmPendingBooking();
  const isExpired = new Date(pendingBooking.expiresAt).getTime() < Date.now();

  return (
    <div className="mx-1 my-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
      <p className="font-bold text-emerald-800">{t("pendingBooking.title")}</p>
      <dl className="mt-2 space-y-1 text-slate-700">
        <div className="flex justify-between">
          <dt>{t("pendingBooking.court")}</dt>
          <dd className="font-medium">{pendingBooking.courtName}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("pendingBooking.date")}</dt>
          <dd className="font-medium">{pendingBooking.bookingDate}</dd>
        </div>
        {pendingBooking.slots.map((slot, index) => (
          <div className="flex justify-between" key={`${slot.startTime}-${slot.endTime}-${index}`}>
            <dt>
              {t("pendingBooking.slot")}
              {pendingBooking.slots.length > 1 ? ` ${index + 1}` : ""}
            </dt>
            <dd className="font-medium">
              {slot.startTime} - {slot.endTime}
            </dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt>{t("pendingBooking.payment")}</dt>
          <dd className="font-medium">{PAYMENT_LABEL[pendingBooking.paymentType]}</dd>
        </div>
        <div className="flex justify-between text-base">
          <dt>{t("pendingBooking.total")}</dt>
          <dd className="font-black text-emerald-700">{pendingBooking.totalAmount.toLocaleString("vi-VN")}đ</dd>
        </div>
      </dl>

      {confirmMutation.isSuccess ? (
        <p className="mt-3 text-center font-bold text-emerald-700">{t("pendingBooking.confirmed")}</p>
      ) : isExpired ? (
        <p className="mt-3 text-center font-medium text-rose-600">{t("pendingBooking.expired")}</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => confirmMutation.mutate(pendingBooking.pendingBookingId)}
            disabled={confirmMutation.isPending}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {confirmMutation.isPending ? t("pendingBooking.confirming") : t("pendingBooking.confirm")}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={confirmMutation.isPending}
            className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {t("pendingBooking.cancel")}
          </button>
        </div>
      )}
      {confirmMutation.isError && (
        <p className="mt-2 text-center text-xs text-rose-600">{(confirmMutation.error as Error).message}</p>
      )}
    </div>
  );
}
