import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi, type AuthSession } from "../../features/auth/api/authApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { loginSchema } from "../../features/auth/schemas/authSchema";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof loginSchema>;

function redirectPath(role: AuthSession["user"]["role"]) {
  return role === "ADMIN" ? "/admin/dashboard" : role === "PARTNER" ? "/partner/dashboard" : "/courts";
}

export function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  function applySession(session: AuthSession) {
    auth.setSession(session.user, session.accessToken ?? session.token!, session.refreshToken);
    navigate(redirectPath(session.user.role));
  }

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => {
      applySession(session);
      toast.success(t("auth.loginSuccess"));
    },
    onError: (error) => toast.error(error.message)
  });

  const googleMutation = useMutation({
    mutationFn: authApi.google,
    onSuccess: (session) => {
      applySession(session);
      toast.success(t("auth.loginSuccess"));
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{t("auth.login")}</h1>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input label={t("fields.email")} {...form.register("email")} error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined} />
        <Input label={t("fields.password")} type="password" {...form.register("password")} error={form.formState.errors.password?.message ? t(form.formState.errors.password.message) : undefined} />
        <Button className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? t("auth.processing") : t("auth.login")}
        </Button>
      </form>
      <div className="mt-4 flex justify-center">
        <GoogleLogin
          onSuccess={(credential) => credential.credential && googleMutation.mutate(credential.credential)}
          onError={() => toast.error(t("auth.googleFailed"))}
          text="continue_with"
        />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        {t("auth.noAccount")}{" "}
        <Link className="font-medium text-action" to="/register">
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
