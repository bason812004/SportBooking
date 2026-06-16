import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { partnerApi } from "../../features/partner/api/partnerApi";

type Values = { businessName: string; address: string; verificationDocumentUrl?: string; bankName?: string; bankAccountNumber?: string; bankAccountHolder?: string; taxCode?: string };

export function PartnerSettingsPage() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["partner-profile"], queryFn: partnerApi.profile });
  const form = useForm<Values>();
  useEffect(() => { if (profile.data) form.reset({ businessName: profile.data.businessName, address: profile.data.address, verificationDocumentUrl: profile.data.verificationDocumentUrl ?? "", bankName: profile.data.bankName ?? "", bankAccountNumber: profile.data.bankAccountNumber ?? "", bankAccountHolder: profile.data.bankAccountHolder ?? "", taxCode: profile.data.taxCode ?? "" }); }, [profile.data, form]);
  const save = useMutation({ mutationFn: partnerApi.updateProfile, onSuccess: async () => { toast.success("Đã lưu hồ sơ. Thông tin sẽ được admin duyệt lại."); await queryClient.invalidateQueries({ queryKey: ["partner-profile"] }); }, onError: (error) => toast.error(error.message) });
  if (profile.isLoading) return <LoadingState />;
  if (profile.isError) return <ErrorState message={profile.error.message} />;
  return <form className="space-y-6" onSubmit={form.handleSubmit(v => save.mutate(v))}>
    <div><h1 className="text-3xl font-bold">Cài đặt đối tác</h1><p className="text-slate-600">Trạng thái hồ sơ: <b>{profile.data?.approvalStatus}</b></p></div>
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 md:grid-cols-2"><h2 className="text-xl font-bold md:col-span-2">Hồ sơ doanh nghiệp</h2><Input label="Tên doanh nghiệp" {...form.register("businessName", { required: true })}/><Input label="Mã số thuế" {...form.register("taxCode")}/><Input className="md:col-span-2" label="Địa chỉ" {...form.register("address", { required: true })}/><Input className="md:col-span-2" label="URL giấy tờ xác minh" type="url" {...form.register("verificationDocumentUrl")}/></section>
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 md:grid-cols-2"><h2 className="text-xl font-bold md:col-span-2">Thông tin nhận thanh toán</h2><Input label="Ngân hàng" {...form.register("bankName")}/><Input label="Số tài khoản" {...form.register("bankAccountNumber")}/><Input label="Chủ tài khoản" {...form.register("bankAccountHolder")}/><div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Tên chủ tài khoản nên trùng với doanh nghiệp hoặc người đại diện hợp pháp.</div></section>
    <Button disabled={save.isPending}>{save.isPending ? "Đang lưu..." : "Lưu cài đặt"}</Button>
  </form>;
}
