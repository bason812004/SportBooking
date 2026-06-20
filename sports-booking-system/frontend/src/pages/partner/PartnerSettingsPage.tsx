import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, CircleDollarSign, FileCheck2, Landmark, Mail, MapPin, Save, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { partnerApi } from "../../features/partner/api/partnerApi";

type Values = {
  fullName: string; phone: string; avatarUrl: string;
  businessName: string; address: string; verificationDocumentUrl: string;
  bankName: string; bankAccountNumber: string; bankAccountHolder: string; taxCode: string;
};

const statusMeta = {
  APPROVED: { label: "Đã phê duyệt", style: "bg-emerald-100 text-emerald-800" },
  PENDING: { label: "Đang chờ duyệt", style: "bg-amber-100 text-amber-800" },
  REJECTED: { label: "Cần bổ sung", style: "bg-red-100 text-red-800" }
};

export function PartnerSettingsPage() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["partner-profile"], queryFn: partnerApi.profile });
  const form = useForm<Values>();

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      fullName: profile.data.user.fullName, phone: profile.data.user.phone ?? "", avatarUrl: profile.data.user.avatarUrl ?? "",
      businessName: profile.data.businessName, address: profile.data.address,
      verificationDocumentUrl: profile.data.verificationDocumentUrl ?? "", bankName: profile.data.bankName ?? "",
      bankAccountNumber: profile.data.bankAccountNumber ?? "", bankAccountHolder: profile.data.bankAccountHolder ?? "", taxCode: profile.data.taxCode ?? ""
    });
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: partnerApi.updateProfile,
    onSuccess: async () => { toast.success("Đã lưu hồ sơ. Thông tin doanh nghiệp được gửi duyệt lại."); await queryClient.invalidateQueries({ queryKey: ["partner-profile"] }); },
    onError: (error) => toast.error(error.message)
  });
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError) return <ErrorState message={profile.error.message} />;

  const data = profile.data!;
  const status = statusMeta[data.approvalStatus];
  const avatar = form.watch("avatarUrl") || data.user.avatarUrl;

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-7 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/25 bg-white/15 text-3xl font-black">
            {avatar ? <img src={avatar} alt={data.businessName} className="h-full w-full object-cover" /> : <Building2 className="h-10 w-10" />}
          </div>
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Hồ sơ đối tác</p><h1 className="mt-2 text-3xl font-black">{data.businessName}</h1><p className="mt-2 flex items-center gap-2 text-sm text-white/70"><Mail className="h-4 w-4" />{data.user.email}</p></div>
          <span className={`md:ml-auto inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${status.style}`}><BadgeCheck className="h-4 w-4" />{status.label}</span>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Heading icon={<UserRound />} title="Người đại diện" description="Thông tin liên hệ chính của tài khoản đối tác" />
        <div className="mt-6 grid gap-5 md:grid-cols-2"><Input label="Họ và tên" {...form.register("fullName", { required: true, minLength: 2 })} /><Input label="Số điện thoại" type="tel" {...form.register("phone")} /><Input label="Email đăng nhập" value={data.user.email} disabled className="bg-slate-50" /><Input label="Ảnh đại diện (URL)" type="url" {...form.register("avatarUrl")} /></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Heading icon={<Building2 />} title="Thông tin doanh nghiệp" description="Thông tin pháp lý và địa chỉ hoạt động" />
        <div className="mt-6 grid gap-5 md:grid-cols-2"><Input label="Tên doanh nghiệp / đơn vị" {...form.register("businessName", { required: true, minLength: 2 })} /><Input label="Mã số thuế" {...form.register("taxCode")} /><Input label="Địa chỉ kinh doanh" {...form.register("address", { required: true, minLength: 5 })} /><Input label="Hồ sơ xác minh (URL)" type="url" {...form.register("verificationDocumentUrl")} /></div>
        <div className="mt-5 flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800"><FileCheck2 className="h-5 w-5 shrink-0" /><p>Cung cấp giấy phép kinh doanh hoặc giấy tờ chứng minh quyền vận hành sân để quá trình duyệt nhanh hơn.</p></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Heading icon={<CircleDollarSign />} title="Thông tin thanh toán" description="Tài khoản nhận doanh thu sau đối soát" />
        <div className="mt-6 grid gap-5 md:grid-cols-3"><Input label="Ngân hàng" {...form.register("bankName")} /><Input label="Số tài khoản" inputMode="numeric" {...form.register("bankAccountNumber")} /><Input label="Tên chủ tài khoản" {...form.register("bankAccountHolder")} /></div>
        <div className="mt-5 grid gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 sm:grid-cols-[auto_1fr]"><Landmark className="h-5 w-5" /><p>Tên chủ tài khoản nên trùng với doanh nghiệp hoặc người đại diện hợp pháp để tránh gián đoạn thanh toán.</p></div>
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur"><p className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><MapPin className="h-4 w-4" />Hãy kiểm tra kỹ thông tin trước khi lưu</p><Button className="ml-auto min-w-40" disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? "Đang lưu..." : "Lưu hồ sơ"}</Button></div>
    </form>
  );
}

function Heading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-center gap-3"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">{icon}</span><div><h2 className="text-xl font-black text-slate-900">{title}</h2><p className="text-sm text-slate-500">{description}</p></div></div>;
}
