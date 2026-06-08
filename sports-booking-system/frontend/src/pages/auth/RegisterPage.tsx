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

type FormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(registerSchema) });
  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ user, token }) => {
      auth.setSession(user, token);
      toast.success("Dang ky thanh cong");
      navigate("/courts");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-md rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Dang ky nguoi dung</h1>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Ho ten" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
        <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="So dien thoai" {...form.register("phone")} />
        <Input label="Mat khau" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
        <Button className="w-full" disabled={mutation.isPending}>Dang ky</Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Muon dang san? <Link className="font-medium text-action" to="/register-partner">Dang ky doi tac</Link>
      </p>
    </div>
  );
}
