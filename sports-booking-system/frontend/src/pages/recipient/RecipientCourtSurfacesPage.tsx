import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, LayoutGrid, LogIn, LogOut, PhoneCall, PlusCircle, TimerReset, Users } from "lucide-react";
import { recipientApi, type RecipientOperationItem } from "../../features/recipient/api/recipientApi";
import { LoadingState, ErrorState, EmptyState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

const statusMeta: Record<RecipientOperationItem["status"], { label: string; className: string }> = {
    AVAILABLE: { label: "Sân trống", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    OCCUPIED: { label: "Đang có khách", className: "border-blue-200 bg-blue-50 text-blue-700" },
    ENDING_SOON: { label: "Sắp hết giờ", className: "border-amber-200 bg-amber-50 text-amber-700" },
    OVERDUE: { label: "Quá giờ chưa trả sân", className: "border-red-200 bg-red-50 text-red-700" },
    RESERVED_SOON: { label: "Sắp có khách", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
    INACTIVE: { label: "Tạm ngưng", className: "border-slate-200 bg-slate-100 text-slate-600" }
};

const extendOptions = [15, 30, 60];
const nowValue = () => new Date().toTimeString().slice(0, 5);
const todayValue = () => new Date().toISOString().slice(0, 10);

type WalkInForm = {
    customerName: string;
    customerPhone: string;
    startTime: string;
    minutes: number;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "E_WALLET";
    note: string;
};

const defaultWalkInForm = (): WalkInForm => ({
    customerName: "",
    customerPhone: "",
    startTime: nowValue(),
    minutes: 60,
    paymentMethod: "CASH",
    note: ""
});

export function RecipientCourtSurfacesPage() {
    const queryClient = useQueryClient();
    const [extendingId, setExtendingId] = useState<string | null>(null);
    const [walkInSurfaceId, setWalkInSurfaceId] = useState<string | null>(null);
    const [walkInForm, setWalkInForm] = useState<WalkInForm>(defaultWalkInForm());
    const operations = useQuery({
        queryKey: ["recipient-operations"],
        queryFn: () => recipientApi.operations(),
        refetchInterval: 60_000
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["recipient-operations"] });

    const toggleStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) => recipientApi.updateCourtSurfaceStatus(id, status),
        onSuccess: () => {
            toast.success("Đã cập nhật trạng thái sân con");
            refresh();
        },
        onError: (error: any) => toast.error(error.message || "Có lỗi xảy ra")
    });

    const extendBooking = useMutation({
        mutationFn: ({ id, minutes }: { id: string; minutes: number }) => recipientApi.extendBooking(id, minutes),
        onSuccess: () => {
            toast.success("Đã gia hạn thời gian chơi cho khách");
            setExtendingId(null);
            refresh();
        },
        onError: (error: any) => toast.error(error.message || "Không thể gia hạn, sân đã có lịch sau đó")
    });

    const earlyCheckIn = useMutation({
        mutationFn: (bookingId: string) => recipientApi.earlyCheckInBooking(bookingId),
        onSuccess: () => {
            toast.success("Đã check-in sớm cho khách");
            refresh();
        },
        onError: (error: any) => toast.error(error.message || "Không thể check-in sớm")
    });

    const earlyCheckOut = useMutation({
        mutationFn: (bookingId: string) => recipientApi.earlyCheckOutBooking(bookingId),
        onSuccess: () => {
            toast.success("Đã check-out sớm cho khách");
            refresh();
        },
        onError: (error: any) => toast.error(error.message || "Không thể check-out sớm")
    });

    const createWalkIn = useMutation({
        mutationFn: () => {
            if (!walkInSurfaceId) throw new Error("Chọn sân con trước khi đặt nhanh");
            return recipientApi.createWalkInBooking({
                courtSurfaceId: walkInSurfaceId,
                customerName: walkInForm.customerName,
                customerPhone: walkInForm.customerPhone,
                bookingDate: todayValue(),
                startTime: walkInForm.startTime,
                minutes: walkInForm.minutes,
                paymentMethod: walkInForm.paymentMethod,
                note: walkInForm.note || undefined
            });
        },
        onSuccess: () => {
            toast.success("Đã tạo booking tại quầy cho khách");
            setWalkInSurfaceId(null);
            setWalkInForm(defaultWalkInForm());
            refresh();
        },
        onError: (error: any) => toast.error(error.message || "Không thể tạo booking, khung giờ đã có khách khác")
    });

    if (operations.isLoading) return <LoadingState />;
    if (operations.isError) return <ErrorState message={operations.error.message} />;

    const data = operations.data!;
    const items = data.items;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Sân con</h1>
                    <p className="text-slate-600">
                        Theo dõi khách đang sử dụng từng sân con của {data.court.name} — cập nhật lúc {data.nowTime} ngày{" "}
                        {new Date(data.date).toLocaleDateString("vi-VN")}.
                    </p>
                </div>
                <Button variant="secondary" onClick={() => refresh()}>
                    Làm mới
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <SummaryCard label="Đang có khách" value={data.summary.occupied} tone="text-blue-700" />
                <SummaryCard label="Sắp hết giờ" value={data.summary.endingSoon} tone="text-amber-700" />
                <SummaryCard label="Quá giờ" value={data.summary.overdue} tone="text-red-700" />
                <SummaryCard label="Sắp có khách" value={data.summary.reservedSoon} tone="text-indigo-700" />
                <SummaryCard label="Đang trống" value={data.summary.available} tone="text-emerald-700" />
            </div>

            {items.length === 0 ? (
                <EmptyState title="Cơ sở chưa có sân con nào" />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                        const meta = statusMeta[item.status];
                        const surface = item.surface;
                        return (
                            <article key={surface.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="relative aspect-[16/9] bg-slate-100">
                                    {surface.imageUrl ? (
                                        <img src={surface.imageUrl} alt={surface.name} className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-slate-400">
                                            <ImageIcon className="h-10 w-10" />
                                        </div>
                                    )}
                                    <span className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>{meta.label}</span>
                                </div>

                                <div className="space-y-3 p-4">
                                    <div>
                                        <h2 className="text-lg font-black text-slate-800">{surface.name}</h2>
                                        <p className="text-sm font-semibold text-slate-500">Mã sân: {surface.code}</p>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                        {surface.surface ? (
                                            <span className="flex items-center gap-1">
                                                <LayoutGrid className="h-4 w-4 shrink-0" />
                                                {surface.surface}
                                            </span>
                                        ) : null}
                                        {surface.capacity ? (
                                            <span className="flex items-center gap-1">
                                                <Users className="h-4 w-4 shrink-0" />
                                                {surface.capacity}
                                            </span>
                                        ) : null}
                                    </div>

                                    {item.currentBooking ? (
                                        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Khách đang chơi</p>
                                            <p className="mt-1 font-black text-slate-800">{item.currentBooking.customerName}</p>
                                            {item.currentBooking.customerPhone ? (
                                                <p className="flex items-center gap-1 text-sm text-slate-600">
                                                    <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                                                    {item.currentBooking.customerPhone}
                                                </p>
                                            ) : null}
                                            <p className="mt-1 text-sm text-slate-600">
                                                {item.currentBooking.startTime} - {item.currentBooking.endTime}
                                                {item.minutesLeft != null && item.minutesLeft > 0 ? (
                                                    <span className="ml-1 font-semibold text-amber-700">(còn {item.minutesLeft} phút)</span>
                                                ) : null}
                                            </p>

                                            {extendingId === surface.id ? (
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    {extendOptions.map((minutes) => (
                                                        <Button
                                                            key={minutes}
                                                            variant="secondary"
                                                            disabled={extendBooking.isPending}
                                                            onClick={() => extendBooking.mutate({ id: item.currentBooking!.id, minutes })}
                                                        >
                                                            +{minutes} phút
                                                        </Button>
                                                    ))}
                                                    <Button variant="ghost" onClick={() => setExtendingId(null)}>
                                                        Hủy
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    className="mt-3 w-full"
                                                    variant="secondary"
                                                    disabled={!item.canExtend}
                                                    title={!item.canExtend ? "Sân đã có lịch đặt ngay sau đó, không thể gia hạn" : undefined}
                                                    onClick={() => setExtendingId(surface.id)}
                                                >
                                                    <TimerReset className="h-4 w-4" />
                                                    Gia hạn thời gian chơi
                                                </Button>
                                            )}

                                            <Button
                                                className="mt-2 w-full"
                                                variant="secondary"
                                                disabled={earlyCheckOut.isPending}
                                                onClick={() => earlyCheckOut.mutate(item.currentBooking!.id)}
                                            >
                                                <LogOut className="h-4 w-4" />
                                                {earlyCheckOut.isPending ? "Đang check-out..." : "Check-out sớm"}
                                            </Button>
                                        </div>
                                    ) : item.nextBooking ? (
                                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Khách sắp nhận sân</p>
                                            <p className="mt-1 font-black text-slate-800">{item.nextBooking.customerName}</p>
                                            <p className="text-sm text-slate-600">
                                                {item.nextBooking.startTime} - {item.nextBooking.endTime}
                                            </p>
                                            <Button
                                                className="mt-3 w-full"
                                                variant="secondary"
                                                disabled={earlyCheckIn.isPending}
                                                onClick={() => earlyCheckIn.mutate(item.nextBooking!.id)}
                                            >
                                                <LogIn className="h-4 w-4" />
                                                {earlyCheckIn.isPending ? "Đang check-in..." : "Check-in sớm"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm font-semibold text-emerald-700">
                                            Sân đang trống, chưa có khách đặt tiếp theo hôm nay.
                                        </div>
                                    )}

                                    {!item.currentBooking && surface.status === "ACTIVE" ? (
                                        walkInSurfaceId === surface.id ? (
                                            <form
                                                className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    createWalkIn.mutate();
                                                }}
                                            >
                                                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Đặt sân tại quầy</p>
                                                <Input
                                                    label="Tên khách"
                                                    value={walkInForm.customerName}
                                                    onChange={(event) => setWalkInForm({ ...walkInForm, customerName: event.target.value })}
                                                    required
                                                />
                                                <Input
                                                    label="Số điện thoại"
                                                    value={walkInForm.customerPhone}
                                                    onChange={(event) => setWalkInForm({ ...walkInForm, customerPhone: event.target.value })}
                                                    required
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Input
                                                        label="Bắt đầu"
                                                        type="time"
                                                        value={walkInForm.startTime}
                                                        onChange={(event) => setWalkInForm({ ...walkInForm, startTime: event.target.value })}
                                                        required
                                                    />
                                                    <Select
                                                        label="Thời lượng"
                                                        value={String(walkInForm.minutes)}
                                                        onChange={(event) => setWalkInForm({ ...walkInForm, minutes: Number(event.target.value) })}
                                                        options={[
                                                            { value: "30", label: "30 phút" },
                                                            { value: "60", label: "60 phút" },
                                                            { value: "90", label: "90 phút" },
                                                            { value: "120", label: "120 phút" }
                                                        ]}
                                                    />
                                                </div>
                                                <Select
                                                    label="Thanh toán"
                                                    value={walkInForm.paymentMethod}
                                                    onChange={(event) => setWalkInForm({ ...walkInForm, paymentMethod: event.target.value as WalkInForm["paymentMethod"] })}
                                                    options={[
                                                        { value: "CASH", label: "Tiền mặt" },
                                                        { value: "BANK_TRANSFER", label: "Chuyển khoản" },
                                                        { value: "E_WALLET", label: "Ví điện tử" }
                                                    ]}
                                                />
                                                <Input
                                                    label="Ghi chú"
                                                    value={walkInForm.note}
                                                    onChange={(event) => setWalkInForm({ ...walkInForm, note: event.target.value })}
                                                />
                                                <div className="flex gap-2">
                                                    <Button className="flex-1" disabled={createWalkIn.isPending}>
                                                        {createWalkIn.isPending ? "Đang tạo..." : "Xác nhận nhận sân"}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setWalkInSurfaceId(null);
                                                            setWalkInForm(defaultWalkInForm());
                                                        }}
                                                    >
                                                        Hủy
                                                    </Button>
                                                </div>
                                            </form>
                                        ) : (
                                            <Button
                                                className="w-full"
                                                variant="secondary"
                                                onClick={() => {
                                                    setWalkInSurfaceId(surface.id);
                                                    setWalkInForm(defaultWalkInForm());
                                                }}
                                            >
                                                <PlusCircle className="h-4 w-4" />
                                                Đặt sân tại quầy
                                            </Button>
                                        )
                                    ) : null}

                                    <Button
                                        className="w-full"
                                        variant={surface.status === "ACTIVE" ? "danger" : "secondary"}
                                        disabled={toggleStatus.isPending}
                                        onClick={() =>
                                            toggleStatus.mutate({
                                                id: surface.id,
                                                status: surface.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                                            })
                                        }
                                    >
                                        {surface.status === "ACTIVE" ? "Tạm ngưng sân" : "Kích hoạt lại"}
                                    </Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
        </div>
    );
}
