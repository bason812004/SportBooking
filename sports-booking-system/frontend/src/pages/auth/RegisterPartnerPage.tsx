import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, ShieldCheck, Mail, ArrowLeft, Building, UserCheck } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../features/auth/api/authApi";
import { registerPartnerSchema, verifyRegistrationCodeSchema } from "../../features/auth/schemas/authSchema";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof registerPartnerSchema>;
type VerifyValues = z.infer<typeof verifyRegistrationCodeSchema>;

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function RegisterPartnerPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingEmail, setPendingEmail] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(registerPartnerSchema) });
  const verifyForm = useForm<VerifyValues>({
    resolver: zodResolver(verifyRegistrationCodeSchema),
    defaultValues: { email: "", code: "" }
  });

  useEffect(() => {
    if (step !== 2) return;
    const timer = window.setInterval(() => {
      setExpiresIn((value) => Math.max(0, value - 1));
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const requestMutation = useMutation({
    mutationFn: authApi.registerPartner,
    onSuccess: (result) => {
      setPendingEmail(result.email);
      setExpiresIn(result.expiresInSeconds);
      setResendIn(60);
      verifyForm.reset({ email: result.email, code: "" });
      setStep(2);
      toast.success(t("auth.codeSent"));
    },
    onError: (error) => toast.error(error.message)
  });

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyPartnerRegistrationCode,
    onSuccess: () => {
      toast.success(t("auth.verificationSuccess"));
      navigate(`/partner/login?email=${encodeURIComponent(pendingEmail)}&registered=1`, { replace: true });
    },
    onError: (error) => toast.error(error.message)
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendPartnerRegistrationCode,
    onSuccess: (result) => {
      setExpiresIn(result.expiresInSeconds);
      setResendIn(60);
      verifyForm.setValue("code", "");
      toast.success(t("auth.codeSent"));
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-6 shadow-sm">
      {/* Step Header */}
      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step === 1 ? "bg-action text-white" : "bg-emerald-100 text-emerald-700"}`}>
            {step === 1 ? "1" : "✓"}
          </div>
          <span className={`text-sm font-medium ${step === 1 ? "text-ink font-semibold" : "text-slate-500"}`}>
            Thông tin đối tác
          </span>
        </div>
        <div className="h-0.5 w-12 bg-line" />
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step === 2 ? "bg-action text-white" : "bg-slate-100 text-slate-500"}`}>
            2
          </div>
          <span className={`text-sm font-medium ${step === 2 ? "text-ink font-semibold" : "text-slate-500"}`}>
            Xác thực OTP
          </span>
        </div>
      </div>

      {step === 1 ? (
        <>
          <div className="mb-5 flex items-center gap-3 rounded-lg bg-emerald-50/80 p-3 text-emerald-900 border border-emerald-100">
            <Building className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-medium leading-relaxed">
              Trở thành đối tác để quản lý sân thể thao, xem báo cáo doanh thu và tiếp cận hàng ngàn khách hàng tiềm năng.
            </p>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => requestMutation.mutate(values))}>
            <Input
              label="Họ tên người đại diện"
              placeholder="Nguyễn Văn A"
              {...form.register("fullName")}
              error={form.formState.errors.fullName?.message ? t(form.formState.errors.fullName.message) : undefined}
            />

            <Input
              label="Email liên hệ"
              type="email"
              placeholder="partner@example.com"
              {...form.register("email")}
              error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined}
            />

            <Input
              label="Số điện thoại liên hệ"
              placeholder="0912345678"
              {...form.register("phone")}
              error={form.formState.errors.phone?.message ? t(form.formState.errors.phone.message) : undefined}
            />

            <Input
              label="Tên đơn vị / Cụm sân"
              placeholder="CLB Thể Thao Ngôi Sao"
              {...form.register("businessName")}
              error={form.formState.errors.businessName?.message ? t(form.formState.errors.businessName.message) : undefined}
            />

            <div className="md:col-span-2">
              <Input
                label="Địa chỉ kinh doanh"
                placeholder="123 Đường ABC, Phường X, Quận Y, TP.HCM"
                {...form.register("address")}
                error={form.formState.errors.address?.message ? t(form.formState.errors.address.message) : undefined}
              />
            </div>

            <div className="relative">
              <Input
                label="Mật khẩu"
                type={showPassword ? "text" : "password"}
                placeholder="Tối thiểu 8 ký tự"
                {...form.register("password")}
                error={form.formState.errors.password?.message ? t(form.formState.errors.password.message) : undefined}
              />
              <button
                type="button"
                className="absolute right-3 top-8.5 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Xác nhận mật khẩu"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                {...form.register("confirmPassword")}
                error={form.formState.errors.confirmPassword?.message ? t(form.formState.errors.confirmPassword.message) : undefined}
              />
              <button
                type="button"
                className="absolute right-3 top-8.5 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button className="md:col-span-2 mt-2" disabled={requestMutation.isPending}>
              {requestMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("auth.processing")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Gửi mã xác thực đăng ký đối tác
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-line pt-4 text-center text-sm text-slate-600">
            Đã có tài khoản đối tác?{" "}
            <Link className="font-semibold text-action hover:underline" to="/partner/login">
              Đăng nhập tại đây
            </Link>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
              <Mail className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-emerald-900">{t("auth.codeSent")}</p>
            <p className="mt-0.5 text-sm font-medium text-emerald-700">{pendingEmail}</p>
            <p className="mt-1 text-xs text-emerald-600">{t("auth.checkInbox")}</p>
          </div>

          <p className={`text-center text-sm font-medium ${expiresIn === 0 ? "text-red-600" : "text-slate-600"}`}>
            {t("auth.codeExpiresAfter").replace("{{time}}", formatCountdown(expiresIn))}
          </p>

          <form
            className="space-y-4"
            onSubmit={verifyForm.handleSubmit((values) => verifyMutation.mutate(values))}
          >
            <input type="hidden" {...verifyForm.register("email")} />
            <Input
              label={t("auth.enterVerificationCode")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-[0.5em] h-12"
              {...verifyForm.register("code", {
                onChange: (event) => {
                  const cleaned = event.target.value.replace(/\D/g, "").slice(0, 6);
                  event.target.value = cleaned;
                  if (cleaned.length === 6 && !verifyMutation.isPending) {
                    verifyForm.handleSubmit((values) => verifyMutation.mutate(values))();
                  }
                }
              })}
              error={verifyForm.formState.errors.code?.message ? t(verifyForm.formState.errors.code.message) : undefined}
            />

            <Button className="w-full" disabled={verifyMutation.isPending || expiresIn === 0}>
              {verifyMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("auth.processing")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t("auth.verifyEmail")}
                </span>
              )}
            </Button>
          </form>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={resendIn > 0 || resendMutation.isPending}
            onClick={() => resendMutation.mutate(pendingEmail)}
          >
            {resendIn > 0 ? t("auth.resendAfter").replace("{{seconds}}", String(resendIn)) : t("auth.resendCode")}
          </Button>

          <button
            type="button"
            className="flex items-center justify-center gap-1.5 w-full text-sm font-medium text-action hover:underline pt-2"
            onClick={() => setStep(1)}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("auth.changeRegistrationInfo")}
          </button>
        </div>
      )}
    </div>
  );
}

