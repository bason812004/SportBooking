import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useCategories } from "../../features/courts/hooks/useCourts";
import { partnerApi } from "../../features/partner/api/partnerApi";

type FormValues = {
  name: string;
  categoryId: string;
  description?: string;
  address: string;
  city: string;
  district: string;
  ward?: string;
  openingTime: string;
  closingTime: string;
};

export function PartnerCourtFormPage() {
  const categories = useCategories();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ defaultValues: { openingTime: "06:00", closingTime: "22:00" } });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => partnerApi.createCourt(values),
    onSuccess: () => {
      toast.success("Da gui san cho admin duyet");
      queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
      navigate("/partner/courts");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <form className="rounded-md border border-line bg-white p-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-2xl font-semibold">Them san moi</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Ten san" {...form.register("name", { required: true })} />
        <Select label="Loai san" {...form.register("categoryId", { required: true })} options={categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? []} />
        <Input label="Dia chi" {...form.register("address", { required: true })} />
        <Input label="Thanh pho" {...form.register("city", { required: true })} />
        <Input label="Quan/Huyen" {...form.register("district", { required: true })} />
        <Input label="Phuong/Xa" {...form.register("ward")} />
        <Input label="Gio mo cua" type="time" {...form.register("openingTime", { required: true })} />
        <Input label="Gio dong cua" type="time" {...form.register("closingTime", { required: true })} />
      </div>
      <Button className="mt-5" disabled={mutation.isPending}>Luu san</Button>
    </form>
  );
}
