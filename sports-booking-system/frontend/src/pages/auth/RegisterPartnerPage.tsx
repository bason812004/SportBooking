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

type FormValues = z.infer<typeof registerPartnerSchema>;

export function RegisterPartnerPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(registerPartnerSchema) });
  const mutation = useMutation({
    mutationFn: authApi.registerPartner,
    onSuccess: ({ user, token }) => {
      auth.setSession(user, token);
      toast.success("Da tao tai khoan doi tac");
      navigate("/partner/dashboard");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto max-w-2xl rounded-md border border-line bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Dang ky doi tac</h1>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Input label="Ho ten" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
        <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="So dien thoai" {...form.register("phone")} />
        <Input label="Mat khau" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
        <Input label="Ten don vi" {...form.register("businessName")} error={form.formState.errors.businessName?.message} />
        <Input label="Dia chi kinh doanh" {...form.register("address")} error={form.formState.errors.address?.message} />
        <Button className="md:col-span-2" disabled={mutation.isPending}>Tao tai khoan doi tac</Button>
      </form>
    </div>
  );
}
