import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../features/auth/api/authApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { registerSchema } from "../../features/auth/schemas/authSchema";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(registerSchema) });
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user, token }) => {
      auth.setSession(user, token);
      toast.success(t("Đăng ký thành công"));
      navigate("/courts");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{t("Đăng ký người dùng")}</h1>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input label={t("Họ tên")} {...form.register("fullName")} error={form.formState.errors.fullName?.message ? t(form.formState.errors.fullName.message) : undefined} />
        <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined} />
        <Input label={t("Số điện thoại")} {...form.register("phone")} />
        <Input label={t("Mật khẩu")} type="password" {...form.register("password")} error={form.formState.errors.password?.message ? t(form.formState.errors.password.message) : undefined} />
        <Button className="w-full" disabled={mutation.isPending}>{t("Đăng ký")}</Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        {t("Muốn đăng sân?")} <Link className="font-medium text-action" to="/register-partner">{t("Đăng ký đối tác")}</Link>
      </p>
    </div>
  );
}
