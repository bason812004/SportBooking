import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { authApi } from "../../features/auth/api/authApi";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { loginSchema } from "../../features/auth/schemas/authSchema";

type FormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user, token }) => {
      auth.setSession(user, token);
      toast.success("Dang nhap thanh cong");
      navigate(user.role === "ADMIN" ? "/admin/dashboard" : user.role === "PARTNER" ? "/partner/dashboard" : "/courts");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Dang nhap</h1>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="Mat khau" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
        <Button className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Dang xu ly" : "Dang nhap"}</Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Chua co tai khoan? <Link className="font-medium text-action" to="/register">Dang ky</Link>
      </p>
    </div>
  );
}
