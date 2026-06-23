import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../features/auth/api/authApi";
import { registerSchema, verifyRegistrationCodeSchema } from "../../features/auth/schemas/authSchema";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof registerSchema>;
type VerifyValues = z.infer<typeof verifyRegistrationCodeSchema>;

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingEmail, setPendingEmail] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const form = useForm<FormValues>({ resolver: zodResolver(registerSchema) });
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
    mutationFn: authApi.register,
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
    mutationFn: authApi.verifyRegistrationCode,
    onSuccess: () => {
      toast.success(t("auth.verificationSuccess"));
      navigate(`/login?email=${encodeURIComponent(pendingEmail)}&registered=1`, { replace: true });
    },
    onError: (error) => toast.error(error.message)
  });

  const resendMutation = useMutation({
    mutationFn: authApi.resendRegistrationCode,
    onSuccess: (result) => {
      setExpiresIn(result.expiresInSeconds);
      setResendIn(60);
      verifyForm.setValue("code", "");
      toast.success(t("auth.codeSent"));
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{t("auth.userRegister")}</h1>

      {step === 1 ? (
        <>
          <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => requestMutation.mutate(values))}>
            <Input label={t("fields.fullName")} {...form.register("fullName")} error={form.formState.errors.fullName?.message ? t(form.formState.errors.fullName.message) : undefined} />
            <Input label={t("fields.email")} type="email" {...form.register("email")} error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined} />
            <Input label={t("fields.phone")} {...form.register("phone")} />
            <Input label={t("fields.password")} type="password" {...form.register("password")} error={form.formState.errors.password?.message ? t(form.formState.errors.password.message) : undefined} />
            <Button className="w-full" disabled={requestMutation.isPending}>
              {requestMutation.isPending ? t("auth.processing") : t("auth.sendVerificationCode")}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-600">
            {t("auth.partnerPrompt")} <Link className="font-medium text-action" to="/register-partner">{t("auth.partnerRegister")}</Link>
          </p>
        </>
      ) : (
        <div className="mt-5">
          <p className="text-sm font-medium text-ink">{t("auth.codeSent")}</p>
          <p className="mt-1 text-sm text-slate-600">{pendingEmail}</p>
          <p className="mt-1 text-sm text-slate-600">{t("auth.checkInbox")}</p>
          <p className={`mt-3 text-sm ${expiresIn === 0 ? "text-red-600" : "text-slate-600"}`}>
            {t("auth.codeExpiresAfter").replace("{{time}}", formatCountdown(expiresIn))}
          </p>
          <form className="mt-4 space-y-4" onSubmit={verifyForm.handleSubmit((values) => verifyMutation.mutate(values))}>
            <input type="hidden" {...verifyForm.register("email")} />
            <Input
              label={t("auth.enterVerificationCode")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="text-center text-xl tracking-[0.45em]"
              {...verifyForm.register("code", { onChange: (event) => { event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6); } })}
              error={verifyForm.formState.errors.code?.message ? t(verifyForm.formState.errors.code.message) : undefined}
            />
            <Button className="w-full" disabled={verifyMutation.isPending || expiresIn === 0}>
              {verifyMutation.isPending ? t("auth.processing") : t("auth.verifyEmail")}
            </Button>
          </form>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full"
            disabled={resendIn > 0 || resendMutation.isPending}
            onClick={() => resendMutation.mutate(pendingEmail)}
          >
            {resendIn > 0 ? t("auth.resendAfter").replace("{{seconds}}", String(resendIn)) : t("auth.resendCode")}
          </Button>
          <button type="button" className="mt-4 w-full text-sm font-medium text-action" onClick={() => setStep(1)}>
            {t("auth.changeRegistrationInfo")}
          </button>
        </div>
      )}
    </div>
  );
}
