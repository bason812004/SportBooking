import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, Building2, CircleDollarSign, FileCheck2, FileUp, ImageUp, KeyRound, Landmark, Mail, MapPin, Save, Trash2, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "../../components/common/States";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { authApi } from "../../features/auth/api/authApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { VIETNAM_BANKS } from "../../features/partner/banks";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { uploadApi } from "../../features/uploads/api/uploadApi";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";

type Values = {
  fullName: string; phone: string; avatarUrl: string;
  businessName: string; address: string; verificationDocumentUrl: string;
  bankName: string; bankAccountNumber: string; bankAccountHolder: string; taxCode: string;
  /** Asked for only when the bank account changes: withdrawals go to it. */
  currentPassword: string;
};

const BANK_FIELDS = ["bankName", "bankAccountNumber", "bankAccountHolder"] as const;
type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };

// The same formats the server checks.
const PHONE_PATTERN = /^(0\d{9,10}|\+84\d{9,10})$/;
const TAX_CODE_PATTERN = /^\d{10}(-?\d{3})?$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{6,20}$/;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const statusMeta = {
  APPROVED: { label: "Đã phê duyệt", style: "bg-emerald-100 text-emerald-800" },
  PENDING: { label: "Đang chờ duyệt", style: "bg-amber-100 text-amber-800" },
  REJECTED: { label: "Cần bổ sung", style: "bg-red-100 text-red-800" }
};

function firstFieldError(error: any) {
  return Object.values((error?.fieldErrors ?? {}) as Record<string, string[]>).flat()[0];
}

const isPdf = (url: string) => /\.pdf($|\?)/i.test(url);

export function PartnerSettingsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const profile = useQuery({ queryKey: ["partner-profile"], queryFn: partnerApi.profile });
  const form = useForm<Values>();
  const passwordForm = useForm<PasswordValues>();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const leaveGuard = useUnsavedChangesGuard(form.formState.isDirty);

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      fullName: profile.data.user.fullName, phone: profile.data.user.phone ?? "", avatarUrl: profile.data.user.avatarUrl ?? "",
      businessName: profile.data.businessName, address: profile.data.address,
      verificationDocumentUrl: profile.data.verificationDocumentUrl ?? "", bankName: profile.data.bankName ?? "",
      bankAccountNumber: profile.data.bankAccountNumber ?? "", bankAccountHolder: profile.data.bankAccountHolder ?? "", taxCode: profile.data.taxCode ?? "",
      currentPassword: ""
    });
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: partnerApi.updateProfile,
    // Only a change to verified details (or a rejected profile) goes back to review, so say which happened.
    onSuccess: async (saved, values) => {
      const resubmitted = saved.approvalStatus === "PENDING" && profile.data?.approvalStatus !== "PENDING";
      toast.success(resubmitted ? "Đã lưu hồ sơ và gửi admin duyệt lại." : "Đã lưu hồ sơ.");
      if (values.currentPassword) {
        toast.info("Tài khoản nhận tiền đã đổi: đã gửi thông báo và email cho bạn; rút tiền mở lại sau 24 giờ.");
      }
      await queryClient.invalidateQueries({ queryKey: ["partner-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["partner-wallet"] });
    },
    onError: (error) => toast.error(firstFieldError(error) || error.message)
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) => authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: (session) => {
      // The old session was ended with every other device's; keep the new one.
      auth.setSession(session.user, session.accessToken, session.refreshToken);
      passwordForm.reset();
      toast.success("Đổi mật khẩu thành công. Các thiết bị khác đã được đăng xuất.");
    },
    onError: (error) => toast.error(firstFieldError(error) || error.message)
  });

  if (profile.isLoading) return <LoadingState />;
  if (profile.isError) return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />;

  const data = profile.data!;
  const status = statusMeta[data.approvalStatus];
  const avatar = form.watch("avatarUrl");
  const documentUrl = form.watch("verificationDocumentUrl");
  // Changing where withdrawals go needs the password (the server checks it too).
  const bankValues = form.watch(BANK_FIELDS);
  const bankChanged = BANK_FIELDS.some((field, index) => (bankValues[index] ?? "").trim() !== (data[field] ?? "").trim());
  const bankOptions = [
    { value: "", label: "Chọn ngân hàng" },
    ...(data.bankName && !(VIETNAM_BANKS as readonly string[]).includes(data.bankName) ? [{ value: data.bankName, label: data.bankName }] : []),
    ...VIETNAM_BANKS.map((bank) => ({ value: bank, label: bank }))
  ];

  const submit = (values: Values) => {
    if (bankChanged && !values.currentPassword) {
      form.setError("currentPassword", { message: "Nhập mật khẩu hiện tại để đổi tài khoản nhận tiền" });
      return;
    }
    save.mutate({ ...values, currentPassword: bankChanged ? values.currentPassword : undefined } as Values, {
      // Saved: the form is clean again (no "leave page?" prompt) until the refetched profile resets it.
      onSuccess: () => form.reset({ ...values, currentPassword: "" })
    });
  };

  // The avatar is stored as soon as it is uploaded (the header shows it at once); removing it waits for "Lưu hồ sơ".
  async function pickAvatar(file?: File | null) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP");
    if (file.size > MAX_AVATAR_BYTES) return toast.error("Ảnh tối đa 5MB");
    setUploadingAvatar(true);
    try {
      const result = await uploadApi.uploadAvatar(file);
      form.setValue("avatarUrl", result.url);
      if (auth.user && auth.token) auth.setSession({ ...auth.user, avatarUrl: result.url }, auth.token, auth.refreshToken ?? undefined);
      await queryClient.invalidateQueries({ queryKey: ["partner-profile"] });
      toast.success("Đã cập nhật ảnh đại diện");
    } catch (error: any) {
      toast.error(error.message || "Không tải được ảnh lên");
    } finally {
      setUploadingAvatar(false);
    }
  }

  // The document link is saved (and sent to admin review) with the rest of the profile.
  async function pickDocument(file?: File | null) {
    if (!file) return;
    if (![...IMAGE_TYPES, "application/pdf"].includes(file.type)) return toast.error("Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc file PDF");
    if (file.size > MAX_DOCUMENT_BYTES) return toast.error("Giấy tờ tối đa 10MB");
    setUploadingDocument(true);
    try {
      const result = await partnerApi.uploadProfileDocument(file);
      form.setValue("verificationDocumentUrl", result.url, { shouldDirty: true });
      toast.success(`Đã tải ${result.fileName} lên. Bấm "Lưu hồ sơ" để gửi admin.`);
    } catch (error: any) {
      toast.error(error.message || "Không tải được giấy tờ lên");
    } finally {
      setUploadingDocument(false);
    }
  }

  return (
    <div className="space-y-6">
      {leaveGuard}
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

      {data.approvalStatus === "REJECTED" && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Hồ sơ chưa được duyệt{data.latestReview?.reason ? `: ${data.latestReview.reason}` : "."}</p>
            <p className="mt-1">Hãy bổ sung thông tin bên dưới rồi bấm "Lưu hồ sơ" để gửi admin duyệt lại.</p>
          </div>
        </div>
      )}
      {data.approvalStatus === "PENDING" && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <FileCheck2 className="h-5 w-5 shrink-0" />
          <p>Hồ sơ đang chờ admin duyệt. Đổi tên doanh nghiệp, mã số thuế hoặc giấy tờ xác minh sẽ cần duyệt lại; các thông tin khác thì không.</p>
        </div>
      )}

      <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Heading icon={<UserRound />} title="Người đại diện" description="Thông tin liên hệ chính của tài khoản đối tác" />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Input label="Họ và tên" {...form.register("fullName", { required: true, minLength: 2 })} />
            <Input
              label="Số điện thoại"
              type="tel"
              placeholder="0901234567"
              {...form.register("phone", {
                validate: (value) => !value.trim() || PHONE_PATTERN.test(value.replace(/[\s.-]/g, "")) || "Số điện thoại không hợp lệ"
              })}
              error={form.formState.errors.phone?.message}
            />
            <Input label="Email đăng nhập" value={data.user.email} disabled className="bg-slate-50" />
            <div className="grid gap-1.5 text-sm font-medium text-ink">
              <span>Ảnh đại diện</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 ${uploadingAvatar ? "pointer-events-none opacity-60" : ""}`}>
                  <ImageUp className="h-4 w-4" />
                  {uploadingAvatar ? "Đang tải lên..." : "Tải ảnh lên"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void pickAvatar(event.target.files?.[0]); event.target.value = ""; }} />
                </label>
                {avatar && (
                  <Button type="button" variant="ghost" onClick={() => form.setValue("avatarUrl", "", { shouldDirty: true })}>
                    <Trash2 className="h-4 w-4" />Gỡ ảnh
                  </Button>
                )}
              </div>
              <p className="text-xs font-normal text-slate-500">JPEG, PNG hoặc WebP, tối đa 5MB. Gỡ ảnh có hiệu lực khi bấm "Lưu hồ sơ".</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Heading icon={<Building2 />} title="Thông tin doanh nghiệp" description="Thông tin pháp lý và địa chỉ hoạt động" />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Input label="Tên doanh nghiệp / đơn vị" {...form.register("businessName", { required: true, minLength: 2 })} />
            <Input
              label="Mã số thuế"
              placeholder="0312345678"
              inputMode="numeric"
              {...form.register("taxCode", {
                validate: (value) => !value.trim() || TAX_CODE_PATTERN.test(value.trim()) || "Mã số thuế gồm 10 chữ số hoặc 10 chữ số kèm 3 số chi nhánh"
              })}
              error={form.formState.errors.taxCode?.message}
            />
            <Input label="Địa chỉ kinh doanh" {...form.register("address", { required: true, minLength: 5 })} />
            <div className="grid gap-1.5 text-sm font-medium text-ink">
              <span>Giấy tờ xác minh</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 ${uploadingDocument ? "pointer-events-none opacity-60" : ""}`}>
                  <FileUp className="h-4 w-4" />
                  {uploadingDocument ? "Đang tải lên..." : documentUrl ? "Thay giấy tờ" : "Tải giấy tờ lên"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { void pickDocument(event.target.files?.[0]); event.target.value = ""; }} />
                </label>
                {documentUrl && (
                  <>
                    <a className="text-sm font-semibold text-emerald-700 underline" href={documentUrl} target="_blank" rel="noopener noreferrer">
                      Xem {isPdf(documentUrl) ? "file PDF" : "ảnh"}
                    </a>
                    <Button type="button" variant="ghost" onClick={() => form.setValue("verificationDocumentUrl", "", { shouldDirty: true })}>
                      <Trash2 className="h-4 w-4" />Gỡ
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs font-normal text-slate-500">Ảnh hoặc PDF, tối đa 10MB. Đổi giấy tờ thì hồ sơ được gửi admin duyệt lại.</p>
            </div>
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800"><FileCheck2 className="h-5 w-5 shrink-0" /><p>Cung cấp giấy phép kinh doanh hoặc giấy tờ chứng minh quyền vận hành sân để quá trình duyệt nhanh hơn.</p></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <Heading icon={<CircleDollarSign />} title="Thông tin thanh toán" description="Tài khoản nhận tiền rút từ Ví" />
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Select label="Ngân hàng" options={bankOptions} {...form.register("bankName")} />
            <Input
              label="Số tài khoản"
              inputMode="numeric"
              {...form.register("bankAccountNumber", {
                validate: (value) => !value.trim() || ACCOUNT_NUMBER_PATTERN.test(value.replace(/[\s-]/g, "")) || "Số tài khoản chỉ gồm 6–20 chữ số"
              })}
              error={form.formState.errors.bankAccountNumber?.message}
            />
            <Input label="Tên chủ tài khoản" placeholder="NGUYEN VAN A" {...form.register("bankAccountHolder")} />
          </div>
          {bankChanged && (
            <div className="mt-5 grid gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 md:grid-cols-[1fr_280px] md:items-end">
              <p className="text-sm text-red-900">
                Bạn đang đổi tài khoản nhận tiền rút. Nhập mật khẩu đăng nhập để xác nhận. Hệ thống sẽ gửi thông báo và email cho bạn, và để an toàn,
                rút tiền chỉ mở lại sau 24 giờ.
              </p>
              <Input
                label="Mật khẩu hiện tại"
                type="password"
                autoComplete="current-password"
                {...form.register("currentPassword")}
                error={form.formState.errors.currentPassword?.message}
              />
            </div>
          )}
          <div className="mt-5 grid gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 sm:grid-cols-[auto_1fr]"><Landmark className="h-5 w-5" /><p>Tên chủ tài khoản được lưu in hoa như trên ngân hàng và nên trùng với doanh nghiệp hoặc người đại diện hợp pháp để tránh gián đoạn thanh toán.</p></div>
        </section>

        <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur"><p className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><MapPin className="h-4 w-4" />{form.formState.isDirty ? "Có thay đổi chưa lưu" : "Hãy kiểm tra kỹ thông tin trước khi lưu"}</p><Button className="ml-auto min-w-40" disabled={save.isPending}><Save className="h-4 w-4" />{save.isPending ? "Đang lưu..." : "Lưu hồ sơ"}</Button></div>
      </form>

      <form
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={passwordForm.handleSubmit((v) => {
          if (v.newPassword !== v.confirmPassword) return passwordForm.setError("confirmPassword", { message: "Mật khẩu xác nhận không khớp" });
          if (v.newPassword === v.currentPassword) return passwordForm.setError("newPassword", { message: "Mật khẩu mới phải khác mật khẩu hiện tại" });
          changePassword.mutate(v);
        })}
      >
        <Heading icon={<KeyRound />} title="Bảo mật" description="Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác và gửi email báo cho bạn" />
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <Input label="Mật khẩu hiện tại" type="password" autoComplete="current-password" {...passwordForm.register("currentPassword", { required: true })} />
          <Input label="Mật khẩu mới" type="password" autoComplete="new-password" {...passwordForm.register("newPassword", { required: true, minLength: { value: 8, message: "Tối thiểu 8 ký tự" } })} error={passwordForm.formState.errors.newPassword?.message} />
          <Input label="Xác nhận mật khẩu mới" type="password" autoComplete="new-password" {...passwordForm.register("confirmPassword", { required: true })} error={passwordForm.formState.errors.confirmPassword?.message} />
        </div>
        <Button className="mt-6" disabled={changePassword.isPending}>{changePassword.isPending ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</Button>
      </form>
    </div>
  );
}

function Heading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex items-center gap-3"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">{icon}</span><div><h2 className="text-xl font-black text-slate-900">{title}</h2><p className="text-sm text-slate-500">{description}</p></div></div>;
}
