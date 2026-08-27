import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { StatCard } from "../../../components/common/StatCard";
import { ReportExportButtons } from "../../../components/common/ReportExportButtons";
import { LoadingState, ErrorState } from "../../../components/common/States";
import { adminCustomerReportApi, adminBookingReportApi, type CustomerReportBooking } from "../api/reportApi";

function currency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function timeText(value: string) {
  return value.slice(11, 16);
}

function BookingDetailRow({ booking }: { booking: CustomerReportBooking }) {
  return (
    <tr className="border-t border-slate-100 bg-slate-50/60">
      <td colSpan={5} className="px-3 py-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Giờ chơi</p>
            <p className="text-sm font-semibold text-slate-700">
              {timeText(booking.startTime)} - {timeText(booking.endTime)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Sân con</p>
            <p className="text-sm font-semibold text-slate-700">{booking.courtSurface?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Thanh toán</p>
            <p className="text-sm font-semibold text-slate-700">{booking.paymentStatus}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Tiền hoàn</p>
            <p className="text-sm font-semibold text-slate-700">{booking.refundAmount > 0 ? currency(booking.refundAmount) : "-"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Voucher</p>
            <p className="text-sm font-semibold text-slate-700">
              {booking.bookingVoucher ? `${booking.bookingVoucher.voucher.code} - ${booking.bookingVoucher.voucher.title}` : "Không dùng"}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-bold uppercase text-slate-500">Dịch vụ đã mua</p>
            {booking.bookingServices.length === 0 ? (
              <p className="text-sm text-slate-500">Không có dịch vụ nào</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {booking.bookingServices.map((service, index) => (
                  <li key={index}>
                    {service.service?.name ?? "Dịch vụ khác"} × {service.quantity} — {currency(service.totalPrice)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-3">
          <ReportExportButtons
            filenameBase={`bao-cao-booking-${booking.bookingCode}`}
            onExport={(format) => adminBookingReportApi.exportReport(booking.id, format)}
          />
        </div>
      </td>
    </tr>
  );
}

export function CustomerReportPanel({ userId }: { userId: string }) {
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const customerReport = useQuery({
    queryKey: ["admin-report-customer-detail", userId],
    queryFn: () => adminCustomerReportApi.get(userId)
  });

  if (customerReport.isLoading) return <LoadingState />;
  if (customerReport.isError) return <ErrorState message={customerReport.error.message} />;
  if (!customerReport.data) return null;

  const data = customerReport.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-800">{data.customer.fullName}</p>
          <p className="text-sm text-slate-500">
            {data.customer.phone ?? "-"} · {data.customer.email ?? "-"}
          </p>
        </div>
        <ReportExportButtons
          filenameBase={`bao-cao-khach-hang-${data.customer.id}`}
          onExport={(format) => adminCustomerReportApi.exportReport(userId, format)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng booking" value={data.summary.totalBookings} icon={UserIcon} iconBg="bg-indigo-100 text-indigo-700" />
        <StatCard label="Hoàn thành" value={data.summary.completedBookings} icon={UserIcon} iconBg="bg-emerald-100 text-emerald-700" />
        <StatCard label="Đã hủy" value={data.summary.cancelledBookings} icon={UserIcon} iconBg="bg-red-100 text-red-700" />
        <StatCard label="Tổng chi tiêu" value={currency(data.summary.totalSpent)} icon={UserIcon} iconBg="bg-blue-100 text-blue-700" />
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase text-slate-500">
              <th className="pb-2">Mã booking</th>
              <th className="pb-2">Ngày</th>
              <th className="pb-2">Sân</th>
              <th className="pb-2">Trạng thái</th>
              <th className="pb-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {data.bookings.map((booking) => {
              const isExpanded = expandedBookingId === booking.id;
              return (
                <Fragment key={booking.id}>
                  <tr
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                  >
                    <td className="py-2 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {booking.bookingCode}
                      </span>
                    </td>
                    <td className="py-2">{new Date(booking.bookingDate).toLocaleDateString("vi-VN")}</td>
                    <td className="py-2">{booking.court.name}</td>
                    <td className="py-2">{booking.bookingStatus}</td>
                    <td className="py-2 text-right font-semibold text-slate-700">{currency(booking.totalPrice)}</td>
                  </tr>
                  {isExpanded ? <BookingDetailRow booking={booking} /> : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
