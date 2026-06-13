import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useCategories } from "../../features/courts/hooks/useCourts";
import { partnerApi } from "../../features/partner/api/partnerApi";
import { useLanguage } from "../../lib/i18n";

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
  images?: FileList;
};

export function PartnerCourtFormPage() {
  const { t } = useLanguage();
  const categories = useCategories();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ defaultValues: { openingTime: "06:00", closingTime: "22:00" } });
  const mutation = useMutation({
    mutationFn: async ({ images, ...values }: FormValues) => {
      const court = await partnerApi.createCourt(values);
      await Promise.all(
        Array.from(images ?? []).map((image, index) =>
          partnerApi.addCourtImage(court.id, image, index)
        )
      );
      return court;
    },
    onSuccess: () => {
      toast.success(t("Đã gửi sân cho admin duyệt"));
      queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
      navigate("/partner/courts");
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <form className="rounded-md border border-line bg-white p-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-2xl font-semibold">{t("Thêm sân mới")}</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label={t("Tên sân")} {...form.register("name", { required: true })} />
        <Select label={t("Loại sân")} {...form.register("categoryId", { required: true })} options={categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? []} />
        <Input label={t("Địa chỉ")} {...form.register("address", { required: true })} />
        <Input label={t("Thành phố")} {...form.register("city", { required: true })} />
        <Input label={t("Quận/Huyện")} {...form.register("district", { required: true })} />
        <Input label={t("Phường/Xã")} {...form.register("ward")} />
        <Input label={t("Giờ mở cửa")} type="time" {...form.register("openingTime", { required: true })} />
        <Input label={t("Giờ đóng cửa")} type="time" {...form.register("closingTime", { required: true })} />
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          {t("Ảnh sân")}
          <input
            className="rounded-md border border-line px-3 py-2"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            {...form.register("images", {
              validate: (files) => {
                if (!files) return true;
                if (files.length > 5) return t("Chỉ được chọn tối đa 5 ảnh");
                if (Array.from(files).some((file) => file.size > 3 * 1024 * 1024)) {
                  return t("Mỗi ảnh phải nhỏ hơn hoặc bằng 3MB");
                }
                const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
                if (Array.from(files).some((file) => !allowedTypes.includes(file.type))) {
                  return t("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP");
                }
                return true;
              }
            })}
          />
          <span className="text-xs font-normal text-slate-500">
            {t("JPEG, PNG hoặc WebP; tối đa 3MB mỗi ảnh.")}
          </span>
          {form.formState.errors.images?.message && (
            <span className="text-xs font-normal text-red-600">
              {form.formState.errors.images.message}
            </span>
          )}
        </label>
      </div>
      <Button className="mt-5" disabled={mutation.isPending}>{t("Lưu sân")}</Button>
    </form>
  );
}
