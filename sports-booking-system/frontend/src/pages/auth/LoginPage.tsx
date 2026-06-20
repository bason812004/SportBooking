import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleLogin } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { Building2, CheckCircle2, LogIn, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

export function LoginPage({ mode = "user" }: { mode?: "user" | "partner" }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const isPartner = mode === "partner";
  const form = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: searchParams.get("email") ?? "", password: "" }
  });

  function applySession(session: AuthSession) {
    if (isPartner && session.user.role !== "PARTNER") {
      toast.error("Tài khoản này không phải tài khoản đối tác.");
      return;
    }
    if (!isPartner && session.user.role === "PARTNER") {
      toast.error("Vui lòng đăng nhập tại cổng dành cho đối tác.");
      navigate(`/partner/login?email=${encodeURIComponent(session.user.email)}`);
      return;
    }
    auth.setSession(session.user, session.accessToken ?? session.token!, session.refreshToken);
    navigate(redirectPath(session.user.role));
    toast.success(t("auth.loginSuccess"));
  }

  const mutation = useMutation({ mutationFn: authApi.login, onSuccess: applySession, onError: (error) => toast.error(error.message) });
  const googleMutation = useMutation({ mutationFn: (credential: string) => authApi.google(credential, isPartner ? "PARTNER" : "USER"), onSuccess: applySession, onError: (error) => toast.error(error.message) });

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-[0.9fr_1.1fr]">
      <aside className={`hidden p-9 text-white md:block ${isPartner ? "bg-gradient-to-br from-emerald-700 to-teal-950" : "bg-gradient-to-br from-blue-600 to-indigo-950"}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          {isPartner ? <Building2 /> : <ShieldCheck />}
        </div>
        <h2 className="mt-8 text-3xl font-black">{isPartner ? "Cổng đối tác" : "Chào mừng trở lại"}</h2>
        <p className="mt-3 text-sm leading-6 text-white/75">
          {isPartner ? "Quản lý sân, lịch đặt và doanh thu trong một không gian riêng dành cho đối tác." : "Đăng nhập để đặt sân, quản lý lịch chơi và tận hưởng các ưu đãi của bạn."}
        </p>
      </aside>
      <main className="p-7 sm:p-10">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isPartner ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}><LogIn /></span>
          <div><h1 className="text-2xl font-black text-slate-900">{isPartner ? "Đăng nhập đối tác" : t("auth.login")}</h1><p className="text-sm text-slate-500">Nhập thông tin tài khoản của bạn</p></div>
        </div>
        {searchParams.get("registered") === "1" && (
          <div className="mt-5 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" /><span>Đăng ký thành công. Email của bạn đã được điền sẵn, hãy nhập mật khẩu để đăng nhập.</span></div>
        )}
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <Input label={t("fields.email")} type="email" autoComplete="email" {...form.register("email")} error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined} />
          <Input label={t("fields.password")} type="password" autoComplete="current-password" {...form.register("password")} error={form.formState.errors.password?.message ? t(form.formState.errors.password.message) : undefined} />
          <Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? t("auth.processing") : t("auth.login")}</Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />hoặc<span className="h-px flex-1 bg-slate-200" /></div>
        <div className="flex justify-center">
          <GoogleLogin onSuccess={(result) => result.credential && googleMutation.mutate(result.credential)} onError={() => toast.error(t("auth.googleFailed"))} text="continue_with" />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          {t("auth.noAccount")} <Link className="font-bold text-action" to={isPartner ? "/register-partner" : "/register"}>{isPartner ? "Đăng ký đối tác" : t("auth.register")}</Link>
        </p>
        <p className="mt-2 text-center text-xs"><Link className="text-slate-500 hover:text-action" to={isPartner ? "/login" : "/partner/login"}>{isPartner ? "Đăng nhập người dùng" : "Bạn là đối tác? Đăng nhập tại đây"}</Link></p>
      </main>
    </div>
  );
}
