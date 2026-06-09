import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../features/auth/api/authApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { registerPartnerSchema } from "../../features/auth/schemas/authSchema";
import { useLanguage } from "../../lib/i18n";

type FormValues = z.infer<typeof registerPartnerSchema>;

export function RegisterPartnerPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(registerPartnerSchema) });
  const mutation = useMutation({
    mutationFn: authApi.registerPartner,
    onSuccess: ({ user, token }) => {
      auth.setSession(user, token);
      toast.success(t("Đã tạo tài khoản đối tác"));
      navigate("/partner/dashboard");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-2xl rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{t("Đăng ký đối tác")}</h1>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input label={t("Họ tên")} {...form.register("fullName")} error={form.formState.errors.fullName?.message ? t(form.formState.errors.fullName.message) : undefined} />
        <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined} />
        <Input label={t("Số điện thoại")} {...form.register("phone")} />
        <Input label={t("Mật khẩu")} type="password" {...form.register("password")} error={form.formState.errors.password?.message ? t(form.formState.errors.password.message) : undefined} />
        <Input label={t("Tên đơn vị")} {...form.register("businessName")} error={form.formState.errors.businessName?.message ? t(form.formState.errors.businessName.message) : undefined} />
        <Input label={t("Địa chỉ kinh doanh")} {...form.register("address")} error={form.formState.errors.address?.message ? t(form.formState.errors.address.message) : undefined} />
        <Button className="md:col-span-2" disabled={mutation.isPending}>{t("Tạo tài khoản đối tác")}</Button>
      </form>
    </div>
  );
}
