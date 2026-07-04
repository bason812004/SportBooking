import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
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
  depositPercent?: number | null;
  images?: FileList;
};

const timeValue = (value?: string) => value?.slice(11, 16) ?? "";

export function PartnerCourtFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const categories = useCategories();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({ defaultValues: { openingTime: "06:00", closingTime: "22:00" } });
  const court = useQuery({
    queryKey: ["partner-court", id],
    queryFn: () => partnerApi.courtDetail(id!),
    enabled: editing
  });

  useEffect(() => {
    if (!court.data) return;
    form.reset({
      name: court.data.name,
      categoryId: court.data.category.id,
      description: court.data.description ?? "",
      address: court.data.address,
      city: court.data.city,
      district: court.data.district,
      ward: court.data.ward ?? "",
      openingTime: timeValue(court.data.openingTime),
      closingTime: timeValue(court.data.closingTime),
      depositPercent: court.data.depositPercent ?? null
    });
  }, [court.data, form]);

  const mutation = useMutation({
    mutationFn: async ({ images, ...values }: FormValues) => {
      const saved = editing
        ? await partnerApi.updateCourt(id!, values)
        : await partnerApi.createCourt(values);
      await Promise.all(
        Array.from(images ?? []).map((image, index) =>
          partnerApi.addCourtImage(saved.id, image, (saved.images?.length ?? 0) + index)
        )
      );
      return saved;
    },
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật sân và gửi duyệt lại" : "Đã gửi sân cho admin duyệt");
      queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
      navigate("/partner/courts");
    },
    onError: (error) => toast.error(error.message)
  });

  if (editing && court.isLoading) return <p>Đang tải...</p>;

  return (
    <form className="rounded-2xl border border-line bg-white p-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <h1 className="text-2xl font-semibold">{editing ? "Chỉnh sửa sân" : "Thêm sân mới"}</h1>
      <p className="mt-1 text-sm text-slate-600">Mọi thay đổi thông tin hoặc ảnh sẽ chuyển sân về trạng thái chờ duyệt.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Tên sân" {...form.register("name", { required: true })} />
        <Select label="Loại sân" {...form.register("categoryId", { required: true })} options={categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? []} />
        <Input label="Địa chỉ" {...form.register("address", { required: true })} />
        <Input label="Thành phố" {...form.register("city", { required: true })} />
        <Input label="Quận/Huyện" {...form.register("district", { required: true })} />
        <Input label="Phường/Xã" {...form.register("ward")} />
        <Input label="Giờ mở cửa" type="time" {...form.register("openingTime", { required: true })} />
        <Input label="Giờ đóng cửa" type="time" {...form.register("closingTime", { required: true })} />
        <Input
          label="% cọc giữ sân"
          type="number"
          min={0}
          max={49.99}
          step={0.01}
          placeholder="Bỏ trống nếu không cần cọc"
          {...form.register("depositPercent", {
            setValueAs: (value) => value === "" || value == null ? null : Number(value),
            min: { value: 0, message: "Cọc không được âm" },
            max: { value: 49.99, message: "Cọc phải dưới 50%" }
          })}
          error={form.formState.errors.depositPercent?.message}
        />
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          Nhập từ 1 đến dưới 50% nếu sân cần cọc. Bỏ trống hoặc nhập 0 thì khách có thể chọn thanh toán tại sân.
        </div>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          Mô tả
          <textarea className="min-h-28 rounded-md border border-line p-3" {...form.register("description")} />
        </label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          {editing ? "Thêm ảnh mới" : "Ảnh sân"}
          <input className="rounded-md border border-line px-3 py-2" type="file" accept="image/jpeg,image/png,image/webp" multiple {...form.register("images")} />
          <span className="text-xs text-slate-500">Tối đa 3 MB mỗi ảnh. Có thể quản lý thứ tự ảnh sau khi lưu.</span>
        </label>
      </div>
      <div className="mt-5 flex gap-2">
        <Button disabled={mutation.isPending}>{mutation.isPending ? "Đang lưu..." : "Lưu sân"}</Button>
        <Button type="button" variant="secondary" onClick={() => navigate("/partner/courts")}>Hủy</Button>
      </div>
    </form>
  );
}
